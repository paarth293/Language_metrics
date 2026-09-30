/**
 * Booking rules — price, availability, and the teacher's calendar.
 *
 * student-web and teacher-web each had their own copy of the booking route and
 * the copies had drifted: one checked availability and overlaps, the other
 * checked neither. The rules now live here once and both routes call them.
 *
 * ── Time zones ─────────────────────────────────────────────────────────────
 *
 * AvailabilitySlot times are wall-clock times in the TEACHER's zone, because
 * that is how the availability editor shows them. A booking instant is UTC.
 * Every comparison converts the instant into the teacher's zone first;
 * comparing UTC hours against local "09:00" rejected valid slots for anyone
 * not on UTC and put slots near midnight on the wrong day.
 *
 * ── Double booking ─────────────────────────────────────────────────────────
 *
 * "Is the teacher free?" followed by "create the session" is a read-then-write
 * race under READ COMMITTED. Every write to a teacher's calendar first takes
 * a transaction-scoped advisory lock on that teacher, so those writes run one
 * at a time per teacher and the overlap check cannot be stale.
 */
import { InsufficientCoinsError, db, getCoinBalance, type Tx } from "@repo/database";
import { DEMO_CLASS_COINS, DEMO_CLASS_MINUTES, assertDemoAvailable } from "./demo";
import { holdCoinsForSession } from "./settlement";

/** Zone assumed for teachers who have not saved one yet. */
export const DEFAULT_TEACHER_TIME_ZONE = process.env.DEFAULT_TEACHER_TIME_ZONE || "Asia/Kolkata";

export const MIN_CLASS_MINUTES = 15;
export const MAX_CLASS_MINUTES = 180;
export const DEFAULT_CLASS_MINUTES = 60;
/** A class can be moved at most this far from the time it was first booked. */
export const RESCHEDULE_WINDOW_MINUTES = 60;

const COMMISSION_PCT = 20;

export class BookingError extends Error {
  constructor(
    readonly code:
      | "TEACHER_NOT_AVAILABLE"
      | "INVALID_RATE"
      | "INVALID_SLOT"
      | "SLOT_REQUIRED"
      | "SLOT_TAKEN"
      | "SESSION_NOT_FOUND"
      | "NOT_RESCHEDULABLE",
    message: string,
    readonly httpStatus: number
  ) {
    super(message);
    this.name = "BookingError";
  }
}

// ── Time-zone arithmetic ───────────────────────────────────────────────────

export interface WeeklySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTeacherTimeZone(timeZone: string | null | undefined): string {
  return timeZone && isValidTimeZone(timeZone) ? timeZone : DEFAULT_TEACHER_TIME_ZONE;
}

/** Wall-clock fields of `instant` as seen in `timeZone`. */
function wallClock(instant: Date, timeZone: string) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    formatters.set(timeZone, f);
  }
  const p = Object.fromEntries(f.formatToParts(instant).map((x) => [x.type, x.value]));
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    minutes: (Number(p.hour) % 24) * 60 + Number(p.minute),
    dayOfWeek: WEEKDAYS.indexOf(p.weekday ?? ""),
  };
}

/** The UTC instant at which it is `minutes` past midnight on y-m-d in `timeZone`. */
function zonedToUtc(year: number, month: number, day: number, minutes: number, timeZone: string): Date {
  const asUtc = Date.UTC(year, month - 1, day, 0, minutes);
  const offsetAt = (t: number) => {
    const w = wallClock(new Date(t), timeZone);
    return Date.UTC(w.year, w.month - 1, w.day, 0, w.minutes) - Math.floor(t / 60_000) * 60_000;
  };
  // Twice, so an instant whose offset differs from the guess's (a DST
  // boundary between them) still lands on the right wall-clock time.
  const first = asUtc - offsetAt(asUtc);
  return new Date(asUtc - offsetAt(first));
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return Number.isFinite(h) && Number.isFinite(m) ? h! * 60 + m! : NaN;
}

/** Does [start, start + duration) sit inside one of the teacher's weekly slots? */
export function fitsAvailability(
  start: Date,
  durationMinutes: number,
  slots: WeeklySlot[],
  timeZone: string
): boolean {
  const w = wallClock(start, timeZone);
  const end = w.minutes + durationMinutes;
  return slots.some(
    (a) => a.dayOfWeek === w.dayOfWeek && w.minutes >= toMinutes(a.startTime) && end <= toMinutes(a.endTime)
  );
}

/** The earliest slot start after `from` that fits `durationMinutes`, or null. */
export function nextAvailableStart(
  slots: WeeklySlot[],
  timeZone: string,
  durationMinutes: number,
  from: Date
): Date | null {
  const today = wallClock(from, timeZone);
  for (let offset = 0; offset <= 7; offset++) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const starts = slots
      .filter((a) => a.dayOfWeek === date.getUTCDay())
      .filter((a) => toMinutes(a.startTime) + durationMinutes <= toMinutes(a.endTime))
      .map((a) => toMinutes(a.startTime))
      .sort((a, b) => a - b);
    for (const minutes of starts) {
      const instant = zonedToUtc(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), minutes, timeZone);
      if (instant > from) return instant;
    }
  }
  return null;
}

// ── Price ──────────────────────────────────────────────────────────────────

/** Length of a booked class. Demos are fixed; otherwise the client may choose. */
export function normaliseDuration(requested: unknown, isDemo: boolean): number {
  if (isDemo) return DEMO_CLASS_MINUTES;
  if (typeof requested !== "number" || !Number.isFinite(requested)) return DEFAULT_CLASS_MINUTES;
  if (requested < MIN_CLASS_MINUTES || requested > MAX_CLASS_MINUTES) return DEFAULT_CLASS_MINUTES;
  return Math.round(requested);
}

/**
 * Coins to hold for a class. An hourly rate scales with length — holding one
 * hour's price for a three-hour class capped the charge at a third of it.
 * A course rate is a fixed price.
 */
export function classPrice(
  rate: { type: "HOURLY" | "COURSE"; amount: number } | null,
  durationMinutes: number
): number {
  if (!rate) return DEMO_CLASS_COINS;
  if (rate.type === "HOURLY") return Math.max(1, Math.round((rate.amount * durationMinutes) / 60));
  return rate.amount;
}

// ── Calendar ───────────────────────────────────────────────────────────────

/** Serialise writes to one teacher's calendar until the transaction ends. */
export async function lockTeacherCalendar(tx: Tx, teacherId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`teacher-calendar:${teacherId}`}))`;
}

/** Call with the calendar lock held. */
export async function assertTeacherFree(
  tx: Tx,
  teacherId: string,
  start: Date,
  end: Date,
  excludeSessionId?: string
): Promise<void> {
  const clash = await tx.classSession.findFirst({
    where: {
      ...(excludeSessionId ? { id: { not: excludeSessionId } } : {}),
      booking: { teacherId },
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      scheduledStart: { lt: end },
      scheduledEnd: { gt: start },
    },
    select: { id: true },
  });
  if (clash) {
    throw new BookingError("SLOT_TAKEN", "This time slot has already been booked by another student.", 409);
  }
}

// ── Booking ────────────────────────────────────────────────────────────────

export interface BookClassInput {
  studentId: string;
  teacherId: string;
  /** null books the teacher's demo class. */
  rateId: string | null;
  /** Unvalidated client value; normalised here. */
  durationMinutes?: unknown;
  /** Explicit start. Omitted: the teacher's next free availability. */
  slotStart?: Date;
}

/**
 * Book a class: booking, session and coin hold commit together or not at all.
 *
 * Throws BookingError, InsufficientCoinsError or DemoAlreadyUsedError.
 */
export async function bookClass(input: BookClassInput, now: Date = new Date()) {
  const { studentId, teacherId, rateId } = input;
  const isDemo = rateId === null;
  const durationMinutes = normaliseDuration(input.durationMinutes, isDemo);

  const teacher = await db.teacherProfile.findUnique({
    where: { userId: teacherId },
    include: {
      rates: rateId ? { where: { id: rateId } } : { take: 0 },
      availability: true,
    },
  });
  if (!teacher || teacher.status !== "APPROVED") {
    throw new BookingError("TEACHER_NOT_AVAILABLE", "Teacher not found or not available", 404);
  }
  const rate = rateId ? teacher.rates[0] : null;
  if (rateId && !rate) throw new BookingError("INVALID_RATE", "Invalid rate selected", 400);

  const price = classPrice(rate ?? null, durationMinutes);
  const bookingType = rate ? (rate.type === "HOURLY" ? "HOURLY" : "COURSE") : "DEMO";
  const timeZone = resolveTeacherTimeZone(teacher.timeZone);

  let slotStart: Date | null;
  if (input.slotStart) {
    if (Number.isNaN(input.slotStart.getTime()) || input.slotStart <= now) {
      throw new BookingError("INVALID_SLOT", "The selected time must be in the future.", 400);
    }
    if (!fitsAvailability(input.slotStart, durationMinutes, teacher.availability, timeZone)) {
      throw new BookingError("INVALID_SLOT", "The selected time is outside the teacher's available hours.", 400);
    }
    slotStart = input.slotStart;
  } else {
    slotStart = nextAvailableStart(teacher.availability, timeZone, durationMinutes, now);
  }
  if (!slotStart) {
    throw new BookingError(
      "SLOT_REQUIRED",
      "This teacher has not published any availability. Please pick a time before booking.",
      400
    );
  }
  const start = slotStart;
  const end = new Date(start.getTime() + durationMinutes * 60_000);

  // Fail fast with a clear message. The authoritative check is the hold's
  // conditional UPDATE inside the transaction.
  const balance = await getCoinBalance(studentId);
  if (balance.balance < price) throw new InsufficientCoinsError(price, balance.balance);

  const commissionAmount = Math.round((price * COMMISSION_PCT) / 100);

  const { booking, session } = await db.$transaction(
    async (tx) => {
      await lockTeacherCalendar(tx, teacherId);
      if (isDemo) await assertDemoAvailable(tx, studentId, teacherId);
      await assertTeacherFree(tx, teacherId, start, end);

      const booking = await tx.booking.create({
        data: {
          studentId,
          teacherId,
          type: bookingType,
          status: "CONFIRMED",
          amountPaid: price,
          commissionPct: COMMISSION_PCT,
          commissionAmount,
          teacherEarnings: price - commissionAmount,
        },
      });
      const session = await tx.classSession.create({
        data: { bookingId: booking.id, scheduledStart: start, scheduledEnd: end, status: "SCHEDULED" },
      });

      // Inside the transaction: settlement and cancellation read "no billing
      // row" as a legacy, already-paid booking, so one must never be created
      // without the other. Insufficient coins here rolls the booking back.
      await holdCoinsForSession(
        { classSessionId: session.id, studentId, teacherId, heldCoins: price, durationMinutes },
        tx
      );

      return { booking, session };
    },
    { timeout: 15_000 }
  );

  return { booking, session, price, isDemo, teacherName: teacher.name };
}

// ── Rescheduling ───────────────────────────────────────────────────────────

/**
 * Move a student's scheduled class. The window is measured from the time the
 * class was first booked, so repeated reschedules cannot walk it anywhere.
 */
export async function rescheduleClass(
  input: { studentId: string; sessionId: string; newStart: Date },
  now: Date = new Date()
) {
  const { studentId, sessionId, newStart } = input;
  if (Number.isNaN(newStart.getTime()) || newStart <= now) {
    throw new BookingError("INVALID_SLOT", "The selected time must be in the future.", 400);
  }

  const owner = await db.classSession.findFirst({
    where: { id: sessionId, booking: { studentId } },
    select: { booking: { select: { teacherId: true } } },
  });
  if (!owner) throw new BookingError("SESSION_NOT_FOUND", "Class session not found.", 404);
  const teacherId = owner.booking.teacherId;

  return db.$transaction(async (tx) => {
    await lockTeacherCalendar(tx, teacherId);

    // Re-read under the lock: a concurrent reschedule or cancel may have
    // changed it since.
    const session = await tx.classSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { booking: { include: { teacher: { include: { availability: true } } } } },
    });
    if (session.status !== "SCHEDULED") {
      throw new BookingError("NOT_RESCHEDULABLE", "Only scheduled classes can be rescheduled.", 400);
    }

    const anchor = session.originalStart ?? session.scheduledStart;
    if (Math.abs(newStart.getTime() - anchor.getTime()) > RESCHEDULE_WINDOW_MINUTES * 60_000) {
      throw new BookingError(
        "INVALID_SLOT",
        "You can only reschedule within a 1-hour window (before or after) of the original time.",
        400
      );
    }

    const durationMinutes = Math.round(
      (session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60_000
    );
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60_000);
    const teacher = session.booking.teacher;

    if (!fitsAvailability(newStart, durationMinutes, teacher.availability, resolveTeacherTimeZone(teacher.timeZone))) {
      throw new BookingError("INVALID_SLOT", "The selected time is outside the teacher's available hours.", 400);
    }
    await assertTeacherFree(tx, teacherId, newStart, newEnd, session.id);

    return tx.classSession.update({
      where: { id: session.id },
      data: { scheduledStart: newStart, scheduledEnd: newEnd, originalStart: anchor },
    });
  });
}

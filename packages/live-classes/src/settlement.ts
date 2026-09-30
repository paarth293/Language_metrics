/**
 * Settlement — turn a finished class into a coin movement.
 *
 * Called from the room_finished webhook and from the reconciliation sweeper.
 * Safe to call twice: a session whose billing row is no longer HELD is left
 * alone and reported as already settled.
 */

import { captureHold, db, hold, refund, releaseHold, type Tx } from "@repo/database";
import {
  computeBillableWindow,
  determineNoShow,
  settleSession,
  type ParticipantPresence,
} from "@repo/livekit";
import { getLiveKitConfig } from "@repo/livekit";

/**
 * How long after the scheduled start a student may still arrive before an
 * absence is billed as a no-show.
 */
export const STUDENT_NO_SHOW_WAIT_MINUTES = 15;

export interface SettlementOutcome {
  classSessionId: string;
  alreadySettled: boolean;
  billableSeconds: number;
  billedMinutes: number;
  chargedCoins: number;
  refundedCoins: number;
  connectionSeconds: number;
  noShow: "NONE" | "TEACHER" | "STUDENT" | "BOTH";
  requiresReview: boolean;
  reason: string;
}

/**
 * Settle one class.
 *
 * The whole thing runs in a single transaction. Partial settlement — coins
 * moved but the session not marked settled, or vice versa — is the failure
 * mode that produces support tickets nobody can reconstruct, so it is made
 * structurally impossible rather than handled.
 */
export async function settleClassSession(
  classSessionId: string,
  opts: { endedAt?: Date; force?: boolean } = {}
): Promise<SettlementOutcome> {
  const config = getLiveKitConfig();

  return db.$transaction(async (tx) => {
    const session = await tx.classSession.findUnique({
      where: { id: classSessionId },
      include: { booking: true, billing: true, participants: true },
    });

    if (!session) throw new Error(`Class session ${classSessionId} not found.`);

    const billing = session.billing;

    if (billing && billing.status !== "HELD" && !opts.force) {
      return {
        classSessionId,
        alreadySettled: true,
        billableSeconds: session.billableSeconds,
        billedMinutes: billing.billedMinutes,
        chargedCoins: billing.chargedCoins,
        refundedCoins: billing.refundedCoins,
        connectionSeconds: session.connectionSeconds,
        noShow: session.noShow,
        requiresReview: billing.requiresReview,
        reason: billing.reason ?? "Already settled.",
      } satisfies SettlementOutcome;
    }

    const endedAt = opts.endedAt ?? new Date();
    const hardEnd = new Date(session.scheduledEnd.getTime() + config.graceMinutes * 60_000);
    // Never meter past the grace window even if the room somehow outlived it.
    const clampTo = Math.min(endedAt.getTime(), hardEnd.getTime());

    const presences: ParticipantPresence[] = session.participants.map((p) => ({
      userId: p.userId,
      role: p.role,
      joinedAt: p.joinedAt.getTime(),
      leftAt: p.leftAt ? p.leftAt.getTime() : null,
    }));

    const window = computeBillableWindow({
      presences,
      studentUserId: session.booking.studentId,
      clampFrom: session.scheduledStart.getTime(),
      clampTo,
    });
    let noShow = determineNoShow(window);

    // A student no-show forfeits the whole hold, so it only counts once the
    // student has had a fair chance to arrive. A class ended before then —
    // by the teacher's end button or the room closing — says nothing about the
    // student, so it is treated like the teacher leaving: full refund, flagged
    // for review.
    const studentWaitEnds = session.scheduledStart.getTime() + STUDENT_NO_SHOW_WAIT_MINUTES * 60_000;
    const endedBeforeStudentWait = noShow === "STUDENT" && clampTo < studentWaitEnds;
    if (endedBeforeStudentWait) noShow = "TEACHER";

    const durationMinutes = Math.max(
      1,
      Math.round((session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60_000)
    );
    const heldCoins = billing?.heldCoins ?? session.booking.amountPaid;
    const coinsPerMinute =
      billing?.coinsPerMinute ?? Math.max(1, Math.round(heldCoins / durationMinutes));

    const settled = settleSession({
      heldCoins,
      coinsPerMinute,
      billableSeconds: window.billableSeconds,
      noShow,
    });
    const result = endedBeforeStudentWait
      ? {
          ...settled,
          reason: `Class ended before the student's ${STUDENT_NO_SHOW_WAIT_MINUTES}-minute joining window closed. Full refund issued; flagged for review.`,
        }
      : settled;

    // Move the coins. captureHold is one statement, so the hold cannot be
    // partially consumed.
    //
    // No billing row means the booking predates holds: its price was SPENT at
    // booking time and nothing is reserved for it. Capturing would consume
    // some other class's hold, so instead the unused part is refunded.
    if (!billing) {
      if (result.refundedCoins > 0) {
        await refund(
          {
            userId: session.booking.studentId,
            amount: result.refundedCoins,
            description: `Refund for class on ${session.scheduledStart.toISOString().slice(0, 10)}`,
            idempotencyKey: `settle:${classSessionId}:refund`,
            classSessionId,
            bookingId: session.bookingId,
          },
          tx
        );
      }
    } else if (heldCoins > 0) {
      await captureHold(
        {
          userId: session.booking.studentId,
          heldAmount: heldCoins,
          chargeAmount: result.chargedCoins,
          description: `Class on ${session.scheduledStart.toISOString().slice(0, 10)}`,
          idempotencyKey: `settle:${classSessionId}`,
          classSessionId,
          bookingId: session.bookingId,
        },
        tx
      );
    }

    await tx.classSession.update({
      where: { id: classSessionId },
      data: {
        status: "COMPLETED",
        actualEnd: new Date(clampTo),
        billableSeconds: window.billableSeconds,
        connectionSeconds: window.connectionSeconds,
        noShow,
      },
    });

    await tx.sessionBilling.upsert({
      where: { classSessionId },
      create: {
        classSessionId,
        studentId: session.booking.studentId,
        teacherId: session.booking.teacherId,
        heldCoins,
        coinsPerMinute,
        billedMinutes: result.billableMinutes,
        chargedCoins: result.chargedCoins,
        refundedCoins: result.refundedCoins,
        overageCoins: result.overageCoins,
        status: result.chargedCoins === 0 ? "REFUNDED" : "SETTLED",
        requiresReview: result.requiresReview,
        reason: result.reason,
        settledAt: new Date(),
      },
      update: {
        billedMinutes: result.billableMinutes,
        chargedCoins: result.chargedCoins,
        refundedCoins: result.refundedCoins,
        overageCoins: result.overageCoins,
        status: result.chargedCoins === 0 ? "REFUNDED" : "SETTLED",
        requiresReview: result.requiresReview,
        reason: result.reason,
        settledAt: new Date(),
      },
    });

    // Teacher earnings follow what the student was actually charged, not what
    // was booked. A 20-minute class does not earn a 60-minute fee.
    if (result.chargedCoins !== session.booking.amountPaid) {
      const commissionAmount = Math.round(
        (result.chargedCoins * session.booking.commissionPct) / 100
      );
      await tx.booking.update({
        where: { id: session.bookingId },
        data: {
          status: "COMPLETED",
          amountPaid: result.chargedCoins,
          commissionAmount,
          teacherEarnings: result.chargedCoins - commissionAmount,
        },
      });
    } else {
      await tx.booking.update({
        where: { id: session.bookingId },
        data: { status: "COMPLETED" },
      });
    }

    if (result.requiresReview) {
      await tx.notification.create({
        data: {
          userId: session.booking.studentId,
          type: "BOOKING_UPDATE",
          title: "Class refunded",
          message: result.reason,
        },
      });
    }

    return {
      classSessionId,
      alreadySettled: false,
      billableSeconds: window.billableSeconds,
      billedMinutes: result.billableMinutes,
      chargedCoins: result.chargedCoins,
      refundedCoins: result.refundedCoins,
      connectionSeconds: window.connectionSeconds,
      noShow,
      requiresReview: result.requiresReview,
      reason: result.reason,
    } satisfies SettlementOutcome;
  });
}

/** Run `fn` in the caller's transaction, or in a fresh one if none is given. */
function inTransaction<T>(client: Tx | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return client ? fn(client) : db.$transaction((tx) => fn(tx));
}

/**
 * Reserve coins for a class at booking time.
 *
 * Call this instead of writing a SPEND row when a class is booked. The
 * student is not charged yet — nothing is spent until minutes are measured.
 *
 * Pass the booking transaction as `client` so the booking, the session and
 * the hold commit together. Settlement and cancellation treat a session with
 * no billing row as a legacy, already-paid booking, so a new booking must
 * never exist without one.
 */
export async function holdCoinsForSession(
  params: {
    classSessionId: string;
    studentId: string;
    teacherId: string;
    heldCoins: number;
    durationMinutes: number;
  },
  client?: Tx
): Promise<void> {
  const coinsPerMinute = Math.max(1, Math.round(params.heldCoins / params.durationMinutes));

  await inTransaction(client, async (tx) => {
    await hold(
      {
        userId: params.studentId,
        amount: params.heldCoins,
        description: "Class booked — coins reserved until the class is measured",
        idempotencyKey: `hold:${params.classSessionId}`,
        classSessionId: params.classSessionId,
      },
      tx
    );

    await tx.sessionBilling.upsert({
      where: { classSessionId: params.classSessionId },
      create: {
        classSessionId: params.classSessionId,
        studentId: params.studentId,
        teacherId: params.teacherId,
        heldCoins: params.heldCoins,
        coinsPerMinute,
        status: "HELD",
      },
      update: {},
    });
  });
}

/** Cancel before the class: the hold goes straight back, nothing is charged. */
export async function refundSessionHold(
  classSessionId: string,
  reason: string,
  client?: Tx
): Promise<void> {
  await inTransaction(client, async (tx) => {
    const billing = await tx.sessionBilling.findUnique({ where: { classSessionId } });
    if (!billing || billing.status !== "HELD") return;

    await releaseHold(
      {
        userId: billing.studentId,
        amount: billing.heldCoins,
        description: reason,
        idempotencyKey: `refund:${classSessionId}`,
        classSessionId,
      },
      tx
    );

    await tx.sessionBilling.update({
      where: { classSessionId },
      data: {
        status: "REFUNDED",
        refundedCoins: billing.heldCoins,
        reason,
        settledAt: new Date(),
      },
    });
  });
}

export class BookingNotCancellableError extends Error {
  readonly code = "BOOKING_NOT_CANCELLABLE";
  constructor(message: string) {
    super(message);
    this.name = "BookingNotCancellableError";
  }
}

/**
 * Cancel a booking and return the student's coins, in one transaction.
 *
 * Handles both billing models:
 *   * held bookings — every HELD billing row is released;
 *   * legacy bookings (no billing row on any session) — the price was spent
 *     at booking time, so `amountPaid` is refunded once.
 *
 * The status flip is a conditional update, so two concurrent cancels cannot
 * both refund: the loser matches no row and gets BookingNotCancellableError.
 */
export async function cancelBookingAndReturnCoins(
  bookingId: string,
  reason: string
): Promise<{ returnedCoins: number }> {
  return db.$transaction(async (tx) => {
    const flipped = await tx.booking.updateMany({
      where: { id: bookingId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { status: "CANCELLED" },
    });
    if (flipped.count === 0) {
      throw new BookingNotCancellableError("Booking is already cancelled or completed.");
    }

    const booking = await tx.booking.findUniqueOrThrow({
      where: { id: bookingId },
      include: { sessions: { include: { billing: true } } },
    });

    await tx.classSession.updateMany({
      where: { bookingId, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });

    const isLegacy = booking.sessions.every((s) => s.billing === null);
    if (isLegacy) {
      if (booking.amountPaid <= 0) return { returnedCoins: 0 };
      await refund(
        {
          userId: booking.studentId,
          amount: booking.amountPaid,
          description: reason,
          idempotencyKey: `cancel:${bookingId}`,
          bookingId,
        },
        tx
      );
      return { returnedCoins: booking.amountPaid };
    }

    let returnedCoins = 0;
    for (const session of booking.sessions) {
      if (session.billing?.status !== "HELD") continue;
      await refundSessionHold(session.id, reason, tx);
      returnedCoins += session.billing.heldCoins;
    }
    return { returnedCoins };
  });
}

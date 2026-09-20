/**
 * POST /api/students/teacher/[id]/book
 *
 * Reworked for metered billing. Three changes from the previous version:
 *
 *   1. Coins are HELD, not SPENT. Nothing is charged until the class has been
 *      measured; the student sees the same total, minus what they cannot
 *      spend twice. A cancellation returns the hold in full.
 *
 *   2. A ClassSession is created. Previously this route created a Booking and
 *      no session, so the class it booked had no id to join, no start time
 *      and no end time — the student paid and then had nothing to attend.
 *      (`/api/v1/bookings`, the mobile route, always did create one.)
 *
 *   3. The balance is read through the ledger rather than by summing the
 *      user's whole CoinTransaction history inside a Serializable
 *      transaction. The hold is a single conditional UPDATE, so the race the
 *      Serializable isolation was there to catch cannot occur, and there is
 *      no retry storm under load.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { InsufficientCoinsError, getCoinBalance } from "@repo/database";
import { holdCoinsForSession } from "@repo/live-classes";
import { invalidateCache } from "@/lib/api-cache";
import { validateBookClass } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { sanitizeOrFallback } from "@/lib/sanitize";

export const runtime = "nodejs";

/** Next occurrence of a weekly availability slot, in UTC. */
function nextOccurrence(dayOfWeek: number, startTime: string, from: Date): Date | null {
  const [h, m] = startTime.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;

  const candidate = new Date(from);
  candidate.setUTCHours(h!, m!, 0, 0);
  const delta = (dayOfWeek - candidate.getUTCDay() + 7) % 7;
  candidate.setUTCDate(candidate.getUTCDate() + delta);
  if (candidate <= from) candidate.setUTCDate(candidate.getUTCDate() + 7);
  return candidate;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const isLimited = await rateLimitRedis(auth.user.sub, "book-class", {
    windowMs: 60_000,
    max: 10,
  });
  if (isLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const { id: teacherId } = await params;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const validation = validateBookClass(body);
    if (!validation.ok) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }
    const { rateId } = validation.data;

    const durationMinutes =
      typeof body.durationMinutes === "number" &&
      body.durationMinutes >= 15 &&
      body.durationMinutes <= 180
        ? Math.round(body.durationMinutes)
        : 60;

    const teacher = await db.teacherProfile.findUnique({
      where: { userId: teacherId },
      include: {
        rates: { where: { id: rateId } },
        availability: { orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] },
      },
    });

    if (!teacher || teacher.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Teacher not found or not available" },
        { status: 404 }
      );
    }
    const rate = teacher.rates[0];
    if (!rate) {
      return NextResponse.json({ error: "Invalid rate selected" }, { status: 400 });
    }

    // Resolve the slot. An explicit slotStart wins; otherwise fall back to the
    // teacher's next published availability. A booking with no time is a
    // booking that cannot be attended, so if neither is available we refuse
    // rather than create one.
    const now = new Date();
    let slotStart: Date | null = null;

    if (typeof body.slotStart === "string") {
      const parsed = new Date(body.slotStart);
      if (Number.isNaN(parsed.getTime()) || parsed <= now) {
        return NextResponse.json(
          { code: "INVALID_SLOT", error: "The selected time must be in the future." },
          { status: 400 }
        );
      }
      slotStart = parsed;
    } else {
      const candidates = teacher.availability
        .map((a) => nextOccurrence(a.dayOfWeek, a.startTime, now))
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      slotStart = candidates[0] ?? null;
    }

    if (!slotStart) {
      return NextResponse.json(
        {
          code: "SLOT_REQUIRED",
          error:
            "This teacher has not published any availability. Please pick a time before booking.",
        },
        { status: 400 }
      );
    }
    const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60_000);

    const balance = await getCoinBalance(auth.user.sub);
    if (balance.balance < rate.amount) {
      return NextResponse.json(
        {
          code: "INSUFFICIENT_COINS",
          error: `You need ${rate.amount} coins but have ${balance.balance}.`,
          required: rate.amount,
          available: balance.balance,
        },
        { status: 400 }
      );
    }

    const commissionPct = 20;
    const commissionAmount = Math.round((rate.amount * commissionPct) / 100);

    const { booking, session } = await db.$transaction(async (tx) => {
      const newBooking = await tx.booking.create({
        data: {
          studentId: auth.user.sub,
          teacherId,
          type: rate.type === "HOURLY" ? "HOURLY" : "COURSE",
          status: "CONFIRMED",
          amountPaid: rate.amount,
          commissionPct,
          commissionAmount,
          teacherEarnings: rate.amount - commissionAmount,
        },
      });

      const newSession = await tx.classSession.create({
        data: {
          bookingId: newBooking.id,
          scheduledStart: slotStart!,
          scheduledEnd: slotEnd,
          status: "SCHEDULED",
        },
      });

      return { booking: newBooking, session: newSession };
    });

    // Held outside the booking transaction on purpose: the hold is its own
    // atomic statement and is keyed by session id, so a crash between the two
    // leaves a booking with no hold — which the reconciliation sweeper
    // reports — rather than coins removed from a student with no booking to
    // show for them.
    try {
      await holdCoinsForSession({
        classSessionId: session.id,
        studentId: auth.user.sub,
        teacherId,
        heldCoins: rate.amount,
        durationMinutes,
      });
    } catch (err) {
      await db.booking.update({
        where: { id: booking.id },
        data: { status: "CANCELLED" },
      });
      await db.classSession.updateMany({
        where: { bookingId: booking.id },
        data: { status: "CANCELLED" },
      });
      if (err instanceof InsufficientCoinsError) {
        return NextResponse.json(
          { code: "INSUFFICIENT_COINS", error: err.message },
          { status: 400 }
        );
      }
      throw err;
    }

    invalidateCache("discover:");
    invalidateCache("dashboard:");

    return NextResponse.json(
      {
        booking: {
          id: booking.id,
          sessionId: session.id,
          type: booking.type,
          status: booking.status,
          amountPaid: booking.amountPaid,
          slotStart: session.scheduledStart.toISOString(),
          slotEnd: session.scheduledEnd.toISOString(),
          createdAt: booking.createdAt,
        },
        message: `Class booked with ${sanitizeOrFallback(teacher.name, "your teacher")}. ${rate.amount} coins are reserved and you are only charged for the minutes you are taught.`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json(
        { code: "INSUFFICIENT_COINS", error: error.message },
        { status: 400 }
      );
    }
    console.error("Error booking class:", error);
    return NextResponse.json({ error: "Failed to book class" }, { status: 500 });
  }
}

/**
 * POST /api/teachers/sessions/[id]/cancel
 *
 * A teacher calls off one of their own scheduled classes.
 *
 * ── Why there is no 4-hour window here ─────────────────────────────────────
 *
 * The student cancel window (`@repo/live-classes/cancel-window`) exists to
 * stop a student walking away from a class the teacher is about to turn up
 * for. Pointed at the teacher it protects nobody: a teacher who cannot teach
 * cannot teach, and refusing the cancel only means the class is silently
 * missed instead — with the student's coins held either way, and the student
 * told nothing. So this route never reads the clock. The obligations run the
 * other way round: the student gets every coin back, and is told.
 *
 * ── Coins ──────────────────────────────────────────────────────────────────
 *
 * The release goes through `refundSessionHold`, the same function
 * `cancelBookingAndReturnCoins` calls for each held session on a student
 * cancel, so one body of code moves coins on a cancel rather than three.
 *
 * ── Calling it twice ───────────────────────────────────────────────────────
 *
 * The status flip is a conditional `updateMany`, so of two concurrent cancels
 * only one matches a row; the loser refunds nothing and writes no second
 * notification. `refundSessionHold` is itself idempotent, but that alone would
 * not stop the student being notified twice, which is why the flip guards the
 * whole block rather than just the coins.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimitRedis } from "@/lib/rate-limit";
import { refundSessionHold } from "@repo/live-classes";
import { requestLogger } from "@repo/logger";

export const runtime = "nodejs";

/** What the student is told. Only the second line mentions coins. */
const NOTICE_TITLE = "Class cancelled by your teacher";
const NOTICE_REFUNDED =
  "Your teacher cancelled this class. The coins held for it are back in your balance.";
const NOTICE_NOT_REFUNDED =
  "Your teacher cancelled this class. Please contact support about anything you were charged for it.";

/** The reason stored on the billing row. It names nobody. */
const REFUND_REASON = "Class cancelled by the teacher";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  const teacherId = auth.user.sub;
  const log = requestLogger(request, { route: "teachers/sessions/[id]/cancel" });

  const isLimited = await rateLimitRedis(teacherId, "teacher-cancel-session", {
    windowMs: 60_000,
    max: 20,
  });
  if (isLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const { id: sessionId } = await context.params;

  try {
    const session = await db.classSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        status: true,
        bookingId: true,
        booking: { select: { teacherId: true, studentId: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Class not found" }, { status: 404 });
    }

    // Whose class this is comes from the booking, never from the request.
    // A teacher holding a valid token for their own account still cannot
    // reach another teacher's class by guessing a session id.
    if (session.booking.teacherId !== teacherId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (session.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot cancel a completed class" },
        { status: 400 }
      );
    }
    if (session.status === "CANCELLED") {
      return NextResponse.json({ error: "Class is already cancelled" }, { status: 400 });
    }

    const outcome = await db.$transaction(async (tx) => {
      const flipped = await tx.classSession.updateMany({
        where: { id: sessionId, status: { notIn: ["CANCELLED", "COMPLETED"] } },
        data: { status: "CANCELLED" },
      });
      if (flipped.count === 0) return null;

      // Whether there is anything to give back, read inside the transaction
      // that is about to give it back. A booking from before holds existed has
      // no billing row: `refundSessionHold` returns without moving coins, and
      // the student must not be told otherwise.
      const billing = await tx.sessionBilling.findUnique({
        where: { classSessionId: sessionId },
        select: { status: true },
      });
      const refunded = billing?.status === "HELD";

      await refundSessionHold(sessionId, REFUND_REASON, tx);

      await tx.notification.create({
        data: {
          userId: session.booking.studentId,
          type: "BOOKING_UPDATE",
          title: NOTICE_TITLE,
          message: refunded ? NOTICE_REFUNDED : NOTICE_NOT_REFUNDED,
        },
      });

      return { refunded };
    });

    // Another cancel landed between the read above and the flip.
    if (!outcome) {
      return NextResponse.json({ error: "Class is already cancelled" }, { status: 409 });
    }

    // The two ids point at the booking, which is where the teacher and student
    // are recorded. Nobody is named here, and no amount is written.
    log.info("teacher cancelled a class", {
      sessionId,
      bookingId: session.bookingId,
      refunded: outcome.refunded,
    });

    return NextResponse.json({
      success: true,
      refunded: outcome.refunded,
      message: "Class cancelled. The student has been notified.",
    });
  } catch (error) {
    log.error("teacher cancel failed", { sessionId, error });
    return NextResponse.json({ error: "Failed to cancel class" }, { status: 500 });
  }
}

/**
 * POST /api/students/classes/[id]/cancel
 *
 * Changed for metered billing: a cancellation now RELEASES the hold rather
 * than writing a REFUND credit.
 *
 * Under the old model coins were spent at booking, so a cancellation had to
 * credit them back. Under holds the coins were never spent — they were moved
 * from spendable to reserved — so crediting a refund on top of releasing the
 * hold would hand the student their money twice. `refundSessionHold` is
 * idempotent and a no-op on a billing row that is not HELD, so a
 * double-submitted cancel cannot double-credit either.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitRedis } from "@/lib/rate-limit";
import { refundSessionHold } from "@repo/live-classes";

export const runtime = "nodejs";

const CANCELLATION_WINDOW_HOURS = 12;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  const isLimited = await rateLimitRedis(auth.user.sub, "cancel-booking", {
    windowMs: 60_000,
    max: 20,
  });
  if (isLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const userId = auth.user.sub;
    const { id: bookingId } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { sessions: { orderBy: { scheduledStart: "asc" } } },
    });

    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    if (booking.studentId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
    }
    if (booking.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot cancel a completed booking" }, { status: 400 });
    }

    const firstSession = booking.sessions[0];
    if (firstSession) {
      const cutoff = new Date(
        firstSession.scheduledStart.getTime() - CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000
      );
      if (new Date() > cutoff) {
        return NextResponse.json(
          {
            error: `Cannot cancel within ${CANCELLATION_WINDOW_HOURS} hours of the scheduled start time.`,
          },
          { status: 400 }
        );
      }
    }

    await prisma.booking.update({
      where: { id: bookingId },
      data: { status: "CANCELLED" },
    });
    await prisma.classSession.updateMany({
      where: { bookingId, status: "SCHEDULED" },
      data: { status: "CANCELLED" },
    });

    // Release every open hold attached to this booking. There is normally one;
    // a course booking can have several.
    for (const session of booking.sessions) {
      await refundSessionHold(
        session.id,
        `Cancelled booking #${booking.id.slice(0, 8)}`
      );
    }

    return NextResponse.json({
      success: true,
      message: "Booking cancelled. The coins reserved for it are available again.",
    });
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}

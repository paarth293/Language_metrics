/**
 * POST /api/students/classes/[id]/cancel
 *
 * Coins go back through `cancelBookingAndReturnCoins`: a held booking has its
 * hold released, a booking paid before holds existed is refunded. The status
 * change and the coin movement share one transaction, and a double-submitted
 * cancel is rejected rather than refunded twice.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rateLimitRedis } from "@/lib/rate-limit";
import { BookingNotCancellableError, cancelBookingAndReturnCoins } from "@repo/live-classes";

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

    await cancelBookingAndReturnCoins(
      bookingId,
      `Cancelled booking #${booking.id.slice(0, 8)}`
    );

    return NextResponse.json({
      success: true,
      message: "Booking cancelled. Your coins are available again.",
    });
  } catch (error) {
    if (error instanceof BookingNotCancellableError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to cancel booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}

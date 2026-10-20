import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  BookingNotCancellableError,
  STUDENT_CANCEL_REFUSAL_CODE,
  cancelBookingAndReturnCoins,
  canStudentCancel,
  studentCancelClosesAt,
  studentCancelRefusalMessage,
} from "@repo/live-classes";

// POST - Cancel a booking
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const { id: bookingId } = await context.params;

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        sessions: {
          orderBy: { scheduledStart: "asc" },
          take: 1,
        },
      },
    });

    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    if (booking.studentId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (booking.status === "CANCELLED") {
      return NextResponse.json({ error: "Booking is already cancelled" }, { status: 400 });
    }

    if (booking.status === "COMPLETED") {
      return NextResponse.json({ error: "Cannot cancel a completed booking" }, { status: 400 });
    }

    // The window is the shared rule in @repo/live-classes, not a number
    // written here, so this copy and student-web's cannot disagree.
    // The server's own clock decides; nothing from the request is consulted.
    const firstSession = booking.sessions[0];
    if (firstSession && !canStudentCancel(firstSession.scheduledStart)) {
      return NextResponse.json(
        {
          error: studentCancelRefusalMessage(),
          code: STUDENT_CANCEL_REFUSAL_CODE,
          cancelClosesAt: studentCancelClosesAt(firstSession.scheduledStart).toISOString(),
        },
        { status: 409 }
      );
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

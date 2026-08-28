import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const firstSession = booking.sessions[0];
    if (firstSession) {
      const scheduledStart = new Date(firstSession.scheduledStart);
      const now = new Date();
      const twelveHoursBefore = new Date(scheduledStart.getTime() - 12 * 60 * 60 * 1000);

      if (now > twelveHoursBefore) {
        return NextResponse.json(
          { error: "Cannot cancel within 12 hours of the scheduled start time." },
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

    if (booking.amountPaid > 0) {
      await prisma.coinTransaction.create({
        data: {
          userId,
          type: "REFUND",
          amount: booking.amountPaid,
          description: `Refund for cancelled booking #${booking.id.slice(0, 8)}`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Booking cancelled successfully. Refund credited to your wallet.",
    });
  } catch (error) {
    console.error("Failed to cancel booking:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}

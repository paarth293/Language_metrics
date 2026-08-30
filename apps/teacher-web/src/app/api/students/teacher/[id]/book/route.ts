import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateCache } from "@/lib/api-cache";

/**
 * POST /api/students/teacher/[id]/book
 * Book a class with a specific teacher.
 * Body: { rateId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const { id: teacherId } = await params;
    const body = await request.json();
    const { rateId } = body;

    if (!rateId) {
      return NextResponse.json({ error: "rateId is required" }, { status: 400 });
    }

    // Verify teacher exists and is approved, and the rate belongs to them
    const teacher = await db.teacherProfile.findUnique({
      where: { userId: teacherId },
      include: { rates: { where: { id: rateId } } },
    });

    if (!teacher || teacher.status !== "APPROVED") {
      return NextResponse.json({ error: "Teacher not found or not available" }, { status: 404 });
    }

    if (teacher.rates.length === 0) {
      return NextResponse.json({ error: "Invalid rate selected" }, { status: 400 });
    }

    const rate = teacher.rates[0];

    // Get current coin balance
    const transactions = await db.coinTransaction.findMany({
      where: { userId: auth.user.sub },
    });
    const balance = transactions.reduce((acc, tx) => acc + tx.amount, 0);

    if (balance < rate.amount) {
      return NextResponse.json(
        { error: `Insufficient coins. You need ${rate.amount} coins but have ${balance}.` },
        { status: 400 }
      );
    }

    // Create booking and deduct coins in a transaction
    const booking = await db.$transaction(async (tx) => {
      // Create the booking
      const newBooking = await tx.booking.create({
        data: {
          studentId: auth.user.sub,
          teacherId,
          type: rate.type === "HOURLY" ? "HOURLY" : "COURSE",
          status: "CONFIRMED",
          amountPaid: rate.amount,
          commissionPct: 20,
          commissionAmount: Math.round(rate.amount * 0.2),
          teacherEarnings: rate.amount - Math.round(rate.amount * 0.2),
        },
      });

      // Deduct coins
      await tx.coinTransaction.create({
        data: {
          userId: auth.user.sub,
          type: "SPEND",
          amount: -rate.amount,
          description: `Booked class with ${teacher.name}`,
        },
      });

      return newBooking;
    });

    return NextResponse.json({
      booking: {
        id: booking.id,
        type: booking.type,
        status: booking.status,
        amountPaid: booking.amountPaid,
        createdAt: booking.createdAt,
      },
      message: "Class booked successfully!",
    }, { status: 201 });

    // Invalidate discover + dashboard caches after booking
    invalidateCache("discover:");
    invalidateCache("dashboard:");
  } catch (error) {
    console.error("Error booking class:", error);
    return NextResponse.json(
      { error: "Failed to book class" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/auth-mobile";
import {
  CreateBookingRequestSchema,
  BookingDetailSchema,
  type BookingDetail,
} from "@repo/api-contracts";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";

class InsufficientCoinsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient coins. You need ${required} coins but have ${available}.`);
  }
}

/**
 * POST /api/v1/bookings
 *
 * Mobile endpoint to book a 1-on-1 session with a teacher using coin balance.
 * Uses Prisma $transaction with Serializable isolation to prevent double-spending.
 */
export async function POST(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const studentId = auth.user.id;

  const isLimited = await rateLimitRedis(studentId, "mobile-book-class", {
    windowMs: 60_000,
    max: 10,
  });
  if (isLimited) {
    return NextResponse.json(
      { message: "Too many booking attempts. Please wait a minute." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parseResult = CreateBookingRequestSchema.safeParse(rawBody);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: "Validation error", errors: parseResult.error.issues },
      { status: 400 }
    );
  }

  const { teacherId, slotStart, durationMinutes } = parseResult.data;

  try {
    const start = new Date(slotStart);
    if (isNaN(start.getTime()) || start < new Date()) {
      return NextResponse.json(
        { message: "Booking start time must be in the future." },
        { status: 400 }
      );
    }
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const booking = await db.$transaction(
      async (tx) => {
        // 1. Check teacher validity
        const teacher = await tx.teacherProfile.findUnique({
          where: { userId: teacherId },
          include: { rates: true },
        });

        if (!teacher || teacher.status !== "APPROVED") {
          throw new Error("TEACHER_NOT_AVAILABLE");
        }

        // 2. Determine coin price (default 500 coins per hour)
        const hourlyRate = teacher.rates?.[0]?.amount
          ? Math.round(Number(teacher.rates[0].amount))
          : 500;
        const totalCost = Math.round((hourlyRate * durationMinutes) / 60);

        // 3. Atomically check balance inside transaction
        const transactions = await tx.coinTransaction.findMany({
          where: { userId: studentId },
        });
        const currentBalance = transactions.reduce((acc, t) => acc + t.amount, 0);

        if (currentBalance < totalCost) {
          throw new InsufficientCoinsError(totalCost, currentBalance);
        }

        // 4. Deduct coins
        await tx.coinTransaction.create({
          data: {
            userId: studentId,
            type: "SPEND",
            amount: -totalCost,
            description: `1-on-1 Class with ${teacher.name} (${durationMinutes}m)`,
          },
        });

        // 5. Calculate platform commission
        const commissionPct = 20;
        const commissionAmount = Math.round((totalCost * commissionPct) / 100);
        const teacherEarnings = totalCost - commissionAmount;

        // 6. Create booking
        const newBooking = await tx.booking.create({
          data: {
            studentId,
            teacherId,
            type: "HOURLY",
            status: "CONFIRMED",
            amountPaid: totalCost,
            commissionPct,
            commissionAmount,
            teacherEarnings,
          },
          include: {
            teacher: { select: { name: true, avatarUrl: true } },
            student: { select: { name: true } },
          },
        });

        // 7. Create scheduled session
        const session = await tx.classSession.create({
          data: {
            bookingId: newBooking.id,
            scheduledStart: start,
            scheduledEnd: end,
            status: "SCHEDULED",
          },
        });

        return { newBooking, session, totalCost };
      },
      {
        isolationLevel: "Serializable",
        timeout: 15000,
      }
    );

    const responsePayload: BookingDetail = {
      id: booking.newBooking.id,
      teacherId: booking.newBooking.teacherId,
      teacherName: booking.newBooking.teacher.name,
      teacherAvatarUrl: booking.newBooking.teacher.avatarUrl ?? null,
      studentId: booking.newBooking.studentId,
      studentName: booking.newBooking.student.name,
      slotStart: booking.session.scheduledStart.toISOString(),
      slotEnd: booking.session.scheduledEnd.toISOString(),
      status: "CONFIRMED",
      coinCost: booking.totalCost,
      meetingUrl: null,
      createdAt: booking.newBooking.createdAt.toISOString(),
    };

    const validated = BookingDetailSchema.parse(responsePayload);
    return NextResponse.json(validated, { status: 201 });
  } catch (error) {
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json(
        { message: error.message, required: error.required, available: error.available },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "TEACHER_NOT_AVAILABLE") {
      return NextResponse.json({ message: "Teacher not found or not available." }, { status: 404 });
    }
    console.error("[Mobile API] Booking error:", error);
    return NextResponse.json({ message: "Failed to create booking." }, { status: 500 });
  }
}

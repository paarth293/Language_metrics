import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/auth-mobile";
import {
  CreateBookingRequestSchema,
  BookingDetailSchema,
  type BookingDetail,
} from "@repo/api-contracts";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { getCoinBalance } from "@repo/database";
import { holdCoinsForSession } from "@repo/live-classes";

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
        const hourlyRateRow =
          teacher.rates?.find((r) => r.type === "HOURLY") ?? teacher.rates?.[0];
        const hourlyRate =
          hourlyRateRow && Number(hourlyRateRow.amount) > 0
            ? Math.round(Number(hourlyRateRow.amount))
            : 500;
        const totalCost = Math.round((hourlyRate * durationMinutes) / 60);

        // 3. Balance check. Read from the materialised CoinAccount rather
        //    than summing the user's entire CoinTransaction history — that
        //    scan grew without bound and, because metered billing writes
        //    several rows per class, would have grown much faster.
        //
        //    The authoritative check is the conditional UPDATE inside
        //    holdCoinsForSession() below; this one exists to fail fast with a
        //    useful message before a booking row is created.
        const balance = await getCoinBalance(studentId, tx);
        if (balance.balance < totalCost) {
          throw new InsufficientCoinsError(totalCost, balance.balance);
        }

        // 4. Coins are NOT spent here. They are held after this transaction
        //    commits, and charged only for minutes actually taught.

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

    // Reserve the coins. One conditional UPDATE, keyed by session id, so a
    // retried request cannot hold twice.
    try {
      await holdCoinsForSession({
        classSessionId: booking.session.id,
        studentId,
        teacherId,
        heldCoins: booking.totalCost,
        durationMinutes,
      });
    } catch (err) {
      // Roll the booking back rather than leaving an unfunded class on the
      // teacher's calendar.
      await db.booking.update({
        where: { id: booking.newBooking.id },
        data: { status: "CANCELLED" },
      });
      await db.classSession.updateMany({
        where: { bookingId: booking.newBooking.id },
        data: { status: "CANCELLED" },
      });
      throw err;
    }

    const responsePayload: BookingDetail = {
      id: booking.newBooking.id,
      sessionId: booking.session.id ?? null,
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

/**
 * POST /api/students/teacher/[id]/book
 *
 * Thin wrapper over `bookClass` in @repo/live-classes, which owns pricing,
 * availability (in the teacher's time zone), the double-booking lock and the
 * coin hold. student-web and teacher-web both serve this route and call the
 * same function, so their rules cannot drift apart.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { InsufficientCoinsError } from "@repo/database";
import { BookingError, DemoAlreadyUsedError, bookClass } from "@repo/live-classes";
import { invalidateCache } from "@/lib/api-cache";
import { validateBookClass } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { sanitizeOrFallback } from "@/lib/sanitize";

export const runtime = "nodejs";

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

    const { booking, session, price, isDemo, teacherName } = await bookClass({
      studentId: auth.user.sub,
      teacherId,
      rateId: validation.data.demo ? null : validation.data.rateId,
      durationMinutes: body.durationMinutes,
      slotStart: typeof body.slotStart === "string" ? new Date(body.slotStart) : undefined,
    });

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
        message: `${isDemo ? "Demo class" : "Class"} booked with ${sanitizeOrFallback(teacherName, "your teacher")}. ${price} coins are reserved and you are only charged for the minutes you are taught.`,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ code: error.code, error: error.message }, { status: error.httpStatus });
    }
    if (error instanceof DemoAlreadyUsedError) {
      return NextResponse.json({ code: "DEMO_ALREADY_USED", error: error.message }, { status: 409 });
    }
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json(
        {
          code: "INSUFFICIENT_COINS",
          error: `You need ${error.required} coins but have ${error.available}.`,
          required: error.required,
          available: error.available,
        },
        { status: 400 }
      );
    }
    console.error("Error booking class:", error);
    return NextResponse.json({ error: "Failed to book class" }, { status: 500 });
  }
}

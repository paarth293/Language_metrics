import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { Prisma } from "@repo/database";
import { invalidateCache } from "@/lib/api-cache";
import { validateBookClass } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { sanitizeOrFallback } from "@/lib/sanitize";

/**
 * POST /api/students/teacher/[id]/book
 * Book a class with a specific teacher.
 * Body: { rateId: string }
 */

// Thrown from inside the transaction when the balance check (re-run under
// Serializable isolation) fails — kept distinct from Prisma's own
// serialization-conflict error so the two map to different, correct HTTP
// statuses instead of both falling into the generic 500 handler.
class InsufficientCoinsError extends Error {
  constructor(public required: number, public available: number) {
    super(`Insufficient coins. You need ${required} coins but have ${available}.`);
  }
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

  // A student spamming this endpoint is either a broken client retrying a
  // failed booking or an attempt to race the balance check below — either
  // way it should be rate-limited like every other mutating route here.
  const isLimited = await rateLimitRedis(auth.user.sub, "book-class", { windowMs: 60_000, max: 10 });
  if (isLimited) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { id: teacherId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // FIX: was `if (!rateId)` with no type check, so a non-string rateId
    // reached Prisma's `where: { id: rateId }` directly.
    const validation = validateBookClass(body);
    if (!validation.ok) {
      return NextResponse.json(
        { code: "VALIDATION_ERROR", error: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }
    const { rateId } = validation.data;

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

    // SECURITY/CORRECTNESS FIX — TOCTOU race condition:
    // The old code read the coin balance with `db.coinTransaction.findMany`
    // OUTSIDE the transaction, checked it against `rate.amount`, and only
    // *then* opened a `$transaction` that created the booking and deducted
    // coins. Two booking requests fired back-to-back (double-click, a retried
    // fetch, or a deliberate attack) could both read the same pre-deduction
    // balance, both pass the `balance < rate.amount` check, and both commit —
    // spending coins the student didn't have twice over. The fix re-reads and
    // re-checks the balance *inside* the transaction, and runs the whole
    // transaction at Serializable isolation so Postgres itself rejects one of
    // two concurrent conflicting transactions instead of letting both commit
    // (caught below as Prisma error P2034 and turned into a 409 the client
    // can safely retry).
    const booking = await db.$transaction(
      async (tx) => {
        const transactions = await tx.coinTransaction.findMany({
          where: { userId: auth.user.sub },
        });
        const balance = transactions.reduce((acc, t) => acc + t.amount, 0);

        if (balance < rate.amount) {
          throw new InsufficientCoinsError(rate.amount, balance);
        }

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
            description: `Booked class with ${sanitizeOrFallback(teacher.name, "your teacher")}`,
          },
        });

        return newBooking;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    // BUG FIX: these two calls were written *after* the `return
    // NextResponse.json(...)` below, making them unreachable dead code — the
    // discover/dashboard caches were never actually invalidated after a
    // booking, so a teacher's availability/stats could show stale data for
    // up to the cache TTL after every single booking. Moved before the
    // return so they actually run.
    invalidateCache("discover:");
    invalidateCache("dashboard:");

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
  } catch (error) {
    if (error instanceof InsufficientCoinsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    // P2034 = "Transaction failed due to a write conflict or a deadlock" —
    // Prisma's signal that Serializable isolation caught a genuine race and
    // rolled one of the two conflicting transactions back. The right
    // response is a 409 the client can retry, not a generic 500.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json(
        { error: "This booking couldn't be completed due to a conflicting request. Please try again." },
        { status: 409 }
      );
    }
    console.error("Error booking class:", error);
    return NextResponse.json(
      { error: "Failed to book class" },
      { status: 500 }
    );
  }
}

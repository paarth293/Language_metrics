import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { compareOtp } from "@/lib/otp";
import { exceedsMaxBodySize } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 *
 * Validates the submitted OTP against the bcrypt hash stored on the User row.
 *
 * Security:
 *  - Failed attempts are tracked in Redis (key: otp:attempts:<email>).
 *  - After 5 wrong attempts the OTP is invalidated — user must request a new one.
 *  - Expired OTPs are rejected and the stale token fields are cleared.
 *  - On success: emailVerified is set to true, all token fields are cleared.
 */
export async function POST(request: NextRequest) {
  // ── 1. Body size guard ──────────────────────────────────────────────────────
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  // ── 2. Parse & validate body ────────────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const { email, otp } = body as { email?: string; otp?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }
  if (!otp || typeof otp !== "string") {
    return NextResponse.json({ message: "Verification code is required." }, { status: 400 });
  }

  // OTP must be exactly 6 digits
  if (!/^\d{6}$/.test(otp)) {
    return NextResponse.json({ message: "Invalid verification code format." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ── 3. Look up user and check for pending verification ──────────────────────
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      emailVerificationToken: true,
      emailVerificationExpiry: true,
    },
  });

  if (!user || !user.emailVerificationToken || !user.emailVerificationExpiry) {
    return NextResponse.json(
      { message: "No pending verification for this email." },
      { status: 400 }
    );
  }

  // ── 4. Check expiry ────────────────────────────────────────────────────────
  const now = new Date();
  if (user.emailVerificationExpiry < now) {
    // Clear stale token fields
    await db.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: null,
        emailVerificationTokenPrefix: null,
        emailVerificationExpiry: null,
      },
    });

    return NextResponse.json(
      { message: "Code expired. Please request a new one." },
      { status: 400 }
    );
  }

  // ── 5. Track failed attempts (Redis) ────────────────────────────────────────
  const redis = getRedisClient();
  const attemptsKey = `otp:attempts:${normalizedEmail}`;

  if (redis) {
    try {
      const attempts = await redis.get(attemptsKey);
      const attemptCount = attempts ? parseInt(attempts, 10) : 0;

      if (attemptCount >= MAX_ATTEMPTS) {
        // Invalidate the OTP — user must request a fresh one
        await db.user.update({
          where: { id: user.id },
          data: {
            emailVerificationToken: null,
            emailVerificationTokenPrefix: null,
            emailVerificationExpiry: null,
          },
        });

        // Clean up the attempts counter
        await redis.del(attemptsKey);

        return NextResponse.json(
          { message: "Too many incorrect attempts. Please request a new code." },
          { status: 429 }
        );
      }
    } catch (err) {
      console.error("[verify-otp] Redis error checking attempts:", err);
      // Continue without attempt tracking if Redis fails
    }
  }

  // ── 6. Compare OTP ─────────────────────────────────────────────────────────
  const isValid = await compareOtp(otp, user.emailVerificationToken);

  if (!isValid) {
    // Increment failed attempts in Redis
    if (redis) {
      try {
        const newCount = await redis.incr(attemptsKey);
        if (newCount === 1) {
          // Set TTL to match the remaining OTP expiry window
          const remainingSeconds = Math.ceil(
            (user.emailVerificationExpiry.getTime() - Date.now()) / 1000
          );
          await redis.expire(attemptsKey, Math.max(remainingSeconds, 60));
        }
      } catch (err) {
        console.error("[verify-otp] Redis error incrementing attempts:", err);
      }
    }

    return NextResponse.json(
      { message: "Incorrect code." },
      { status: 400 }
    );
  }

  // ── 7. OTP matches — verify the user ────────────────────────────────────────
  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenPrefix: null,
      emailVerificationExpiry: null,
    },
  });

  // Clear Redis attempts counter
  if (redis) {
    try {
      await redis.del(attemptsKey);
    } catch (err) {
      console.error("[verify-otp] Redis error clearing attempts:", err);
    }
  }

  return NextResponse.json(
    { success: true, message: "Email verified successfully." },
    { status: 200 }
  );
}

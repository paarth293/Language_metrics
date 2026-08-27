import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getRedisClient } from "@/lib/redis-client";
import { compareOtp } from "@/lib/otp";
import { exceedsMaxBodySize } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;

/**
 * POST /api/auth/verify-registration-otp
 * Body: { email, otp }
 *
 * Verifies a pre-registration OTP stored in Redis.
 * On success, sets a `reg-otp:verified:<email>` flag (30-min TTL)
 * that the registration endpoint can check.
 */
export async function POST(request: NextRequest) {
  try {
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

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
  if (!otp || typeof otp !== "string" || !/^\d{6}$/.test(otp)) {
    return NextResponse.json({ message: "A valid 6-digit code is required." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  const redis = getRedisClient();
  if (!redis) {
    return NextResponse.json(
      { message: "Service temporarily unavailable." },
      { status: 503 }
    );
  }

  // ── 1. Retrieve stored OTP hash ────────────────────────────────────────────
  const hashKey = `reg-otp:hash:${normalizedEmail}`;
  const storedHash = await redis.get(hashKey);

  if (!storedHash) {
    return NextResponse.json(
      { message: "No pending verification for this email. Please request a new code." },
      { status: 400 }
    );
  }

  // ── 2. Check attempt count ─────────────────────────────────────────────────
  const attemptsKey = `reg-otp:attempts:${normalizedEmail}`;

  try {
    const attempts = await redis.get(attemptsKey);
    const attemptCount = attempts ? parseInt(attempts, 10) : 0;

    if (attemptCount >= MAX_ATTEMPTS) {
      // Invalidate the OTP
      await redis.del(hashKey);
      await redis.del(attemptsKey);

      return NextResponse.json(
        { message: "Too many incorrect attempts. Please request a new code." },
        { status: 429 }
      );
    }
  } catch (err) {
    console.error("[verify-registration-otp] Redis attempts check error:", err);
  }

  // ── 3. Compare OTP ─────────────────────────────────────────────────────────
  const isValid = await compareOtp(otp, storedHash);

  if (!isValid) {
    // Increment attempts
    try {
      const newCount = await redis.incr(attemptsKey);
      if (newCount === 1) {
        await redis.expire(attemptsKey, 600); // 10-minute TTL matching OTP
      }
    } catch (err) {
      console.error("[verify-registration-otp] Redis increment error:", err);
    }

    return NextResponse.json(
      { message: "Incorrect code." },
      { status: 400 }
    );
  }

  // ── 4. OTP is correct — set verified flag ──────────────────────────────────
  try {
    // Flag valid for 30 minutes — enough time to complete registration
    await redis.set(`reg-otp:verified:${normalizedEmail}`, "1", "EX", 1800);
    // Clean up OTP hash and attempts
    await redis.del(hashKey);
    await redis.del(attemptsKey);
  } catch (err) {
    console.error("[verify-registration-otp] Redis verified flag error:", err);
  }

  return NextResponse.json(
    { success: true, message: "Email verified successfully." },
    { status: 200 }
  );
  } catch (err) {
    console.error("[verify-registration-otp] Unhandled error:", err);
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

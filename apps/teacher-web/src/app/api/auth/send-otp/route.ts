import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendVerificationOTP } from "@/lib/email";
import { exceedsMaxBodySize } from "@/lib/rate-limit";

/**
 * POST /api/auth/send-otp
 * Body: { email }
 *
 * Generates a 6-digit OTP, hashes it, stores it in the EmailVerificationCode
 * table, and sends it via Resend.
 *
 * Rate limiting (Redis):
 *  - 60-second cooldown per email (prevents spamming)
 *  - 5 OTPs per email per hour (prevents abuse)
 *
 * Security:
 *  - OTP is bcrypt-hashed before storage — never stored in plaintext.
 *  - OTP is stored in the EmailVerificationCode table with a bcrypt hash,
 *    consistent with the verify-email POST route.
 *  - OTP is NEVER returned in the API response.
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

  const { email } = body as { email?: string };

  if (!email || typeof email !== "string") {
    return NextResponse.json({ message: "Email is required." }, { status: 400 });
  }

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  // ── 3. Redis rate limiting ──────────────────────────────────────────────────
  const redis = getRedisClient();

  if (redis) {
    try {
      // 3a. 60-second cooldown
      const cooldownKey = `otp:cooldown:${normalizedEmail}`;
      const cooldownExists = await redis.exists(cooldownKey);
      if (cooldownExists) {
        return NextResponse.json(
          { message: "Please wait before requesting another code." },
          { status: 429, headers: { "Retry-After": "60" } }
        );
      }

      // 3b. Hourly cap (max 5 per hour)
      const hourlyKey = `otp:hourly:${normalizedEmail}`;
      const hourlyCount = await redis.incr(hourlyKey);
      // Set expiry only on first increment (when count becomes 1)
      if (hourlyCount === 1) {
        await redis.expire(hourlyKey, 3600);
      }
      if (hourlyCount > 5) {
        return NextResponse.json(
          { message: "Too many requests. Please try again later." },
          { status: 429, headers: { "Retry-After": "3600" } }
        );
      }
    } catch (err) {
      // Redis failure — log but don't block the request
      console.error("[send-otp] Redis error during rate limiting:", err);
    }
  }

  // ── 4. Look up user ─────────────────────────────────────────────────────────
  // NOTE: Returning 404 reveals whether an email is registered. This is a
  // deliberate tradeoff for better UX during email verification flows.
  // To prevent email enumeration, change this to always return 200 with a
  // generic message like "If an account exists, we sent a code."
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, username: true, email: true },
  });

  if (!user) {
    return NextResponse.json(
      { message: "No account found with this email." },
      { status: 404 }
    );
  }

  // ── 5. Generate OTP, hash, and save to DB ───────────────────────────────────
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  // Clean up any old verification codes for this user, then store the new one
  await db.emailVerificationCode.deleteMany({
    where: { userId: user.id },
  });

  await db.emailVerificationCode.create({
    data: {
      userId: user.id,
      codeHash: otpHash,
      expiresAt,
    },
  });

  // ── 6. Send OTP email ───────────────────────────────────────────────────────
  const emailSent = await sendVerificationOTP(user.email, otp);
  if (!emailSent) {
    console.error("[send-otp] Failed to send OTP email.");
    return NextResponse.json(
      { message: "Failed to send verification email. Please try again." },
      { status: 500 }
    );
  }

  // ── 7. Set Redis cooldown ───────────────────────────────────────────────────
  if (redis) {
    try {
      await redis.set(`otp:cooldown:${normalizedEmail}`, "1", "EX", 60);
    } catch (err) {
      console.error("[send-otp] Redis error setting cooldown:", err);
    }
  }

  // ── 8. Success ──────────────────────────────────────────────────────────────
  return NextResponse.json(
    { message: "Verification code sent." },
    { status: 200 }
  );
}

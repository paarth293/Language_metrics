import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendVerificationOTP } from "@/lib/email";
import { exceedsMaxBodySize } from "@/lib/rate-limit";

import { memoryOtpStore } from "@/lib/memory-otp-store";

/**
 * POST /api/auth/send-registration-otp
 * Body: { email }
 *
 * Pre-registration OTP: verifies email ownership BEFORE the user account
 * exists in the database. The OTP hash is stored in Redis (or in-memory
 * if Redis is unavailable in local development).
 *
 * Flow:
 *  1. Check email isn't already registered (reject if so).
 *  2. Rate-limit (60s cooldown + 5/hour cap) — skipped without Redis.
 *  3. Generate OTP, hash, store in Redis (or memory fallback) with 10-minute TTL.
 *  4. Send OTP via Resend.
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

    const { email } = body as { email?: string };

    if (!email || typeof email !== "string") {
      return NextResponse.json({ message: "Email is required." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // ── 1. Check if email is already registered ─────────────────────────────────
    // Return a generic success to prevent email enumeration.
    // The actual registration step will reject duplicate emails.
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Verification code sent." },
        { status: 200 }
      );
    }

    // ── 2. Redis rate limiting (skipped if Redis is unavailable) ────────────────
    const redis = getRedisClient();

    if (redis) {
      try {
        // 60-second cooldown
        const cooldownKey = `reg-otp:cooldown:${normalizedEmail}`;
        const cooldownExists = await redis.exists(cooldownKey);
        if (cooldownExists) {
          return NextResponse.json(
            { message: "Please wait before requesting another code." },
            { status: 429, headers: { "Retry-After": "60" } }
          );
        }

        // Hourly cap (max 5)
        const hourlyKey = `reg-otp:hourly:${normalizedEmail}`;
        const hourlyCount = await redis.incr(hourlyKey);
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
        console.error("[send-registration-otp] Redis rate limit error:", err);
        // Continue without rate limiting rather than blocking
      }
    } else {
      console.warn("[send-registration-otp] Redis unavailable — rate limiting disabled.");
    }

    // ── 3. Generate OTP, hash, store ────────────────────────────────────────────
    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    if (redis) {
      try {
        // Store the hash in Redis with 10-minute TTL
        await redis.set(`reg-otp:hash:${normalizedEmail}`, otpHash, "EX", 600);
        // Reset attempt counter for this email
        await redis.del(`reg-otp:attempts:${normalizedEmail}`);
        // Set 60-second cooldown
        await redis.set(`reg-otp:cooldown:${normalizedEmail}`, "1", "EX", 60);
      } catch (err) {
        console.error("[send-registration-otp] Redis storage error:", err);
        return NextResponse.json(
          { message: "Failed to generate verification code. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // In-memory fallback for local development without Redis
      memoryOtpStore.setHash(normalizedEmail, otpHash);
      console.warn("[send-registration-otp] OTP stored in memory (Redis unavailable).");
    }

    if (process.env.NODE_ENV !== "production") {
      console.log(`\n==================================================`);
      console.log(`🔑 REGISTRATION OTP FOR [${normalizedEmail}]: ${otp}`);
      console.log(`==================================================\n`);
    }

    // ── 4. Send OTP email ───────────────────────────────────────────────────────
    const emailSent = await sendVerificationOTP(normalizedEmail, otp);
    if (!emailSent) {
      console.error("[send-registration-otp] Email send failed.");
      return NextResponse.json(
        { message: "Failed to send verification email. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Verification code sent." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[send-registration-otp] Unhandled error:", err);
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendVerificationOTP } from "@/lib/email";
import { exceedsMaxBodySize, rateLimit } from "@/lib/rate-limit";

import { memoryOtpStore } from "@/lib/memory-otp-store";
import { printForDevelopment } from "@/lib/dev-console";
import { requestLogger } from "@repo/logger";

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

    const normalizedEmail = email.toLowerCase().trim();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
      return NextResponse.json({ message: "Invalid email format." }, { status: 400 });
    }

    // ── 1. Check if email is already registered ─────────────────────────────────
    const [existingUser, existingAdmin] = await Promise.all([
      db.user?.findUnique({
        where: { email: normalizedEmail },
        select: { id: true },
      }),
      db.adminUser?.findUnique({
        where: { email: normalizedEmail },
        select: { userId: true },
      }),
    ]);

    if (existingUser || existingAdmin) {
      return NextResponse.json(
        {
          code: "EMAIL_ALREADY_EXISTS",
          message:
            "This email address is already registered. Please use another email address or sign in to your existing account.",
        },
        { status: 409 }
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
        requestLogger(request).error("[send-registration-otp] Redis rate limit error, using in-process limiter", { error: err });
        // Same limits, enforced per instance, so a Redis outage does not
        // switch rate limiting off.
        if (rateLimit(`reg-otp:cooldown:${normalizedEmail}`, { windowMs: 60_000, max: 1 })) {
          return NextResponse.json(
            { message: "Please wait before requesting another code." },
            { status: 429, headers: { "Retry-After": "60" } }
          );
        }
        if (rateLimit(`reg-otp:hourly:${normalizedEmail}`, { windowMs: 3_600_000, max: 5 })) {
          return NextResponse.json(
            { message: "Too many requests. Please try again later." },
            { status: 429, headers: { "Retry-After": "3600" } }
          );
        }
      }
    } else {
      requestLogger(request).warn("[send-registration-otp] Redis unavailable — rate limiting disabled.");
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
        requestLogger(request).error("[send-registration-otp] Redis storage error", { error: err });
        return NextResponse.json(
          { message: "Failed to generate verification code. Please try again." },
          { status: 500 }
        );
      }
    } else {
      // In-memory fallback for local development without Redis
      memoryOtpStore.setHash(normalizedEmail, otpHash);
      requestLogger(request).warn("[send-registration-otp] OTP stored in memory (Redis unavailable).");
    }

    // Local development only: there may be no email provider to deliver it.
    printForDevelopment([`🔑 REGISTRATION OTP FOR [${normalizedEmail}]: ${otp}`]);

    // ── 4. Send OTP email ───────────────────────────────────────────────────────
    const emailSent = await sendVerificationOTP(normalizedEmail, otp);
    if (!emailSent) {
      requestLogger(request).error("[send-registration-otp] Email send failed.");
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
    requestLogger(request).error("[send-registration-otp] Unhandled error", { error: err });
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

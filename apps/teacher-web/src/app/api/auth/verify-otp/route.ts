import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { compareOtp } from "@/lib/otp";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;

/**
 * POST /api/auth/verify-otp
 * Body: { email, otp }
 *
 * Validates the submitted 6-digit OTP against the most recent EmailVerificationCode
 * row for the user (the same store `send-otp`/the registration OTP flow write to
 * and that `verify-email`'s POST handler reads) — NOT the User.emailVerificationToken
 * field, which only ever holds a bcrypt hash of the long link-style verification
 * token used by the GET /api/auth/verify-email flow, never an OTP hash.
 *
 * Security:
 *  - Failed attempts are tracked both in Redis (key: otp:attempts:<email>) and via
 *    the EmailVerificationCode row's own `attempts` counter.
 *  - After 5 wrong attempts the code is invalidated — user must request a new one.
 *  - Expired codes are rejected.
 *  - On success: emailVerified is set to true and the code row is deleted.
 */
export async function POST(request: NextRequest) {
  // ── 1. Body size guard ──────────────────────────────────────────────────────
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  // ── 1b. Per-IP rate limiting — 20 OTP verifications per IP per 15 min ──────
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isLimited = await rateLimitRedis(ip, "verify-otp", {
    windowMs: 15 * 60_000,
    max: 20,
  });
  if (isLimited) {
    return NextResponse.json(
      { message: "Too many attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": "900" } }
    );
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

  // ── 3. Look up user and their most recent verification code ─────────────────
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: {
      id: true,
      emailVerified: true,
      verificationCodes: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!user) {
    return NextResponse.json(
      { message: "No pending verification for this email." },
      { status: 400 }
    );
  }

  if (user.emailVerified) {
    return NextResponse.json({ message: "Email is already verified." }, { status: 400 });
  }

  const verificationCode = user.verificationCodes[0];
  if (!verificationCode) {
    return NextResponse.json(
      { message: "No pending verification for this email." },
      { status: 400 }
    );
  }

  // ── 4. Check expiry ────────────────────────────────────────────────────────
  const now = new Date();
  if (verificationCode.expiresAt < now) {
    return NextResponse.json(
      { message: "Code expired. Please request a new one." },
      { status: 400 }
    );
  }

  if (verificationCode.attempts >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { message: "Too many incorrect attempts. Please request a new code." },
      { status: 429 }
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
        // Invalidate the code — user must request a fresh one
        await db.emailVerificationCode.delete({ where: { id: verificationCode.id } }).catch(() => {});

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
  const isValid = await compareOtp(otp, verificationCode.codeHash);

  if (!isValid) {
    // Increment failed attempts, both on the code row and in Redis
    await db.emailVerificationCode.update({
      where: { id: verificationCode.id },
      data: { attempts: { increment: 1 } },
    }).catch(() => {});

    if (redis) {
      try {
        const newCount = await redis.incr(attemptsKey);
        if (newCount === 1) {
          // Set TTL to match the remaining code expiry window
          const remainingSeconds = Math.ceil(
            (verificationCode.expiresAt.getTime() - Date.now()) / 1000
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

  // ── 7. OTP matches — verify the user and consume the code ───────────────────
  await db.$transaction([
    db.user.update({
      where: { id: user.id },
      data: { emailVerified: true },
    }),
    db.emailVerificationCode.delete({
      where: { id: verificationCode.id },
    }),
  ]);

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

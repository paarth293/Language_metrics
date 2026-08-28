import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getRedisClient } from "@/lib/redis-client";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendMail } from "@/lib/zoho-mailer";
import { exceedsMaxBodySize } from "@/lib/rate-limit";
import { escapeHtml } from "@/lib/sanitize";

/**
 * POST /api/auth/send-otp
 * Body: { email }
 *
 * Generates a 6-digit OTP, hashes it, stores it on the User row,
 * and sends it via Zoho SMTP.
 *
 * Rate limiting (Redis):
 *  - 60-second cooldown per email (prevents spamming)
 *  - 5 OTPs per email per hour (prevents abuse)
 *
 * Security:
 *  - OTP is bcrypt-hashed before storage — never stored in plaintext.
 *  - Only the first 3 digits are kept as a plaintext prefix for
 *    support/debug lookups (not enough to reconstruct the full code).
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
  // Always return a generic success message to prevent email enumeration.
  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, username: true, email: true },
  });

  if (!user) {
    // Set the cooldown even for unknown emails to prevent probing
    if (redis) {
      try {
        await redis.set(`otp:cooldown:${normalizedEmail}`, "1", "EX", 60);
      } catch { /* best effort */ }
    }
    return NextResponse.json(
      { message: "If an account exists, a verification code has been sent." },
      { status: 200 }
    );
  }

  // ── 5. Generate OTP, hash, and save to DB ───────────────────────────────────
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  const prefix = otp.slice(0, 3); // First 3 digits for debug/support lookup

  await db.user.update({
    where: { id: user.id },
    data: {
      emailVerificationToken: otpHash,
      emailVerificationTokenPrefix: prefix,
      emailVerificationExpiry: expiry,
    },
  });

  // ── 6. Send OTP email ───────────────────────────────────────────────────────
  try {
    await sendMail({
      to: user.email,
      subject: "Your Language Metrics verification code",
      html: `
        <div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="font-size:24px;font-weight:700;color:#1a1a2e;margin:0">Language Metrics</h1>
          </div>
          <p style="color:#4e5674;margin-bottom:8px">Hi ${escapeHtml(user.username || "there")} 👋</p>
          <p style="color:#4e5674;margin-bottom:24px">
            Use the following code to verify your email address. It expires in <strong>10 minutes</strong>.
          </p>
          <div style="background:#f8f6f1;border:2px solid #c7982f;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#1a1a2e;font-family:monospace">${otp}</span>
          </div>
          <p style="color:#8a93a6;font-size:13px">
            If you didn't request this code, you can safely ignore this email.
            Do not share this code with anyone.
          </p>
          <hr style="border:none;border-top:1px solid #e8e5de;margin:24px 0" />
          <p style="color:#b0aaa0;font-size:11px;text-align:center">
            This is an automated message from Language Metrics. Please do not reply to this email.<br />
            © ${new Date().getFullYear()} Language Metrics. All rights reserved.
          </p>
        </div>
      `,
    });
  } catch (err) {
    console.error("[send-otp] Failed to send OTP email:", err);
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
    { message: "If an account exists, a verification code has been sent." },
    { status: 200 }
  );
}

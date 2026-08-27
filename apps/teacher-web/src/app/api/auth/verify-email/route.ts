import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { hashOtp } from "@/lib/otp";
import { rateLimit } from "@/lib/rate-limit";

/**
 * POST /api/auth/verify-email
 * Body: { email, otp }
 *
 * OTP-based email verification (6-digit code).
 * Used by the verify-email page when the user enters a code from their inbox.
 */
export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 60_000, max: 10 })) {
    return NextResponse.json(
      { message: "Too many attempts. Please try again later." },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const { email, otp } = body;

    if (!email || !otp || typeof email !== "string" || typeof otp !== "string") {
      return NextResponse.json({ message: "Email and OTP are required." }, { status: 400 });
    }

    const user = await db.user.findUnique({
      where: { email },
      include: {
        verificationCodes: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        studentProfile: true,
        teacherProfile: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email is already verified." }, { status: 400 });
    }

    const verificationCode = user.verificationCodes[0];
    if (!verificationCode) {
      return NextResponse.json({ message: "No active verification code found." }, { status: 400 });
    }

    if (verificationCode.attempts >= 5) {
      return NextResponse.json(
        { message: "Too many failed attempts. Please request a new code." },
        { status: 400 }
      );
    }

    if (verificationCode.expiresAt < new Date()) {
      return NextResponse.json(
        { message: "Verification code expired. Please request a new code." },
        { status: 400 }
      );
    }

    const submittedHash = await hashOtp(otp);
    if (submittedHash !== verificationCode.codeHash) {
      await db.emailVerificationCode.update({
        where: { id: verificationCode.id },
        data: { attempts: { increment: 1 } },
      });
      return NextResponse.json({ message: "Invalid verification code." }, { status: 400 });
    }

    // Success: Transaction to mark verified and delete code
    await db.$transaction([
      db.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
      }),
      db.emailVerificationCode.delete({
        where: { id: verificationCode.id },
      }),
    ]);

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error("verify-email (POST) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Token-link email verification.
 * Validates the one-time email verification token sent via link in the email.
 *
 * Token format: "{prefix}:{uuid}" where prefix is 8 hex chars stored in plain
 * text for fast indexed lookup, and the full token is bcrypt-hashed for security.
 *
 * On success: marks user as verified and clears the token from DB.
 * On failure: returns 400 (never reveals whether the token is wrong or expired).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  // Minimum length check (prefix 8 + ":" + UUID 36 = 45 chars)
  if (!token || token.length < 45) {
    return NextResponse.json({ message: "Invalid verification link." }, { status: 400 });
  }

  // Extract prefix for fast DB lookup (no bcrypt needed for filtering)
  const prefix = token.slice(0, 8);

  const now = new Date();
  const candidate = await db.user.findFirst({
    where: {
      emailVerificationTokenPrefix: prefix,
      emailVerificationToken: { not: null },
      emailVerificationExpiry: { gt: now },
      emailVerified: false,
    },
    select: {
      id: true,
      emailVerificationToken: true,
    },
  });

  if (!candidate?.emailVerificationToken) {
    return NextResponse.json(
      { message: "This verification link is invalid or has expired." },
      { status: 400 }
    );
  }

  // Timing-safe comparison against the single candidate
  const isValid = await bcrypt.compare(token, candidate.emailVerificationToken);

  if (!isValid) {
    return NextResponse.json(
      { message: "This verification link is invalid or has expired." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: candidate.id },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationTokenPrefix: null,
      emailVerificationExpiry: null,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

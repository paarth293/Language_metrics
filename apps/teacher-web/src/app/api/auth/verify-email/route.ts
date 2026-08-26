import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Validates the one-time email verification token.
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


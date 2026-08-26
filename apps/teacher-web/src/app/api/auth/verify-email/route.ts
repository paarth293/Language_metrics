import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

/**
 * GET /api/auth/verify-email?token=xxx
 *
 * Validates the one-time email verification token.
 * On success: marks user as verified and clears the token from DB.
 * On failure: returns 400 (never reveals whether the token is simply wrong or expired).
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  if (!token || token.length < 32) {
    return NextResponse.json({ message: "Invalid verification link." }, { status: 400 });
  }

  // Find users with a non-expired verification token
  const now = new Date();
  const candidates = await db.user.findMany({
    where: {
      emailVerificationToken: { not: null },
      emailVerificationExpiry: { gt: now },
      emailVerified: false,
    },
    select: {
      id: true,
      emailVerificationToken: true,
    },
  });

  // Compare token against all candidates (bcrypt timing-safe)
  let matchedId: string | null = null;
  for (const candidate of candidates) {
    if (candidate.emailVerificationToken) {
      const ok = await bcrypt.compare(token, candidate.emailVerificationToken);
      if (ok) {
        matchedId = candidate.id;
        break;
      }
    }
  }

  if (!matchedId) {
    return NextResponse.json(
      { message: "This verification link is invalid or has expired." },
      { status: 400 }
    );
  }

  await db.user.update({
    where: { id: matchedId },
    data: {
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpiry: null,
    },
  });

  return NextResponse.json({ success: true }, { status: 200 });
}

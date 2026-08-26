import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { revokeAllRefreshSessions } from "@/lib/redis-session";
import { rateLimit, exceedsMaxBodySize } from "@/lib/rate-limit";
import { z } from "zod";
import { PASSWORD_RULES } from "@/features/auth/validators/auth";

const resetPasswordSchema = z.object({
  token: z.string().min(32, "Invalid token."),
  password: z
    .string()
    .min(PASSWORD_RULES.minLength, "Password must be at least 8 characters.")
    .max(PASSWORD_RULES.maxLength, "Password is too long.")
    .regex(PASSWORD_RULES.uppercase, "Password must contain at least one uppercase letter.")
    .regex(PASSWORD_RULES.lowercase, "Password must contain at least one lowercase letter.")
    .regex(PASSWORD_RULES.digit, "Password must contain at least one number."),
}).strict();

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 *
 * Validates the reset token, updates the password, and revokes ALL existing
 * sessions (in case the account was compromised).
 */
export async function POST(request: NextRequest) {
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 15 * 60_000, max: 10 })) {
    return NextResponse.json(
      { message: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const result = resetPasswordSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid inputs.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const { token, password } = result.data;

  // Find users with a non-expired reset token
  const now = new Date();
  const candidates = await db.user.findMany({
    where: {
      passwordResetToken: { not: null },
      passwordResetExpiry: { gt: now },
    },
    select: { id: true, passwordResetToken: true },
  });

  // Timing-safe comparison against all candidates
  let matchedId: string | null = null;
  for (const candidate of candidates) {
    if (candidate.passwordResetToken) {
      const ok = await bcrypt.compare(token, candidate.passwordResetToken);
      if (ok) {
        matchedId = candidate.id;
        break;
      }
    }
  }

  if (!matchedId) {
    return NextResponse.json(
      { message: "This reset link is invalid or has expired." },
      { status: 400 }
    );
  }

  // Hash new password and clear the token
  const newHash = await bcrypt.hash(password, 12);
  await db.user.update({
    where: { id: matchedId },
    data: {
      passwordHash: newHash,
      passwordResetToken: null,
      passwordResetExpiry: null,
    },
  });

  // Revoke ALL sessions — if the account was compromised, force re-login everywhere
  await revokeAllRefreshSessions(matchedId).catch((err) =>
    console.error("[Redis] Failed to revoke all sessions after password reset:", err)
  );

  // Clear auth cookies in the response (log out current device too)
  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
  return response;
}

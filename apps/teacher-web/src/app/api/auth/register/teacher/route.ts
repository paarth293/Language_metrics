import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getRedisClient } from "@/lib/redis-client";
import { sendVerificationEmail } from "@/lib/email";
import { rateLimit, exceedsMaxBodySize } from "@/lib/rate-limit";
import { registerTeacherSchema } from "@/features/auth/validators/auth";
import { AuthService } from "@/features/auth/services/auth-service";
import {
  signAccessToken,
  signRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/tokens";
import { storeRefreshSession } from "@/lib/redis-session";

/**
 * POST /api/auth/register/teacher
 * Body: { name, email, password, language, gender?, experienceType }
 *
 * On success:
 *  - Creates user + teacher profile (status: PENDING — awaits admin approval).
 *  - Sends email verification email.
 *  - Issues access + refresh token cookies.
 *  - Returns { user, requiresVerification: true }.
 */
export async function POST(request: NextRequest) {
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 60_000, max: 5 })) {
    return NextResponse.json(
      { message: "Too many registration attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const result = registerTeacherSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid inputs.";
    return NextResponse.json({ message }, { status: 400 });
  }

  const redis = getRedisClient();
  let emailVerified = false;
  if (redis) {
    const isVerified = await redis.get(`reg-otp:verified:${result.data.email.toLowerCase().trim()}`);
    if (isVerified) {
      emailVerified = true;
    }
  }

  const authResult = await AuthService.registerTeacher(result.data, emailVerified);
  if (!authResult) {
    return NextResponse.json(
      { message: "An account with this email already exists." },
      { status: 409 }
    );
  }

  if (!emailVerified) {
    // Generate email verification token with a prefix for fast DB lookup
    // Format: "{8-hex-prefix}:{uuid}" — prefix stored plain, full token bcrypt-hashed
    const tokenUUID = crypto.randomUUID();
    const tokenPrefix = tokenUUID.replace(/-/g, "").slice(0, 8);
    const verificationToken = `${tokenPrefix}:${tokenUUID}`;
    const tokenHash = await bcrypt.hash(verificationToken, 10);
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.user.update({
      where: { id: authResult.user.id },
      data: {
        emailVerificationToken: tokenHash,
        emailVerificationTokenPrefix: tokenPrefix,
        emailVerificationExpiry: expiry,
      },
    });

    sendVerificationEmail(
      authResult.user.email,
      authResult.user.name,
      verificationToken
    ).catch((err) => console.error("[Email] Failed to send verification email:", err));
  }

  const sessionId = crypto.randomUUID();
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(authResult.user.id, authResult.user.role),
    signRefreshToken(authResult.user.id, sessionId),
  ]);

  await storeRefreshSession(authResult.user.id, sessionId, {
    ip,
    ua: request.headers.get("user-agent") ?? undefined,
  });

  const response = NextResponse.json(
    { user: authResult.user, requiresVerification: !emailVerified },
    { status: 201 }
  );

  response.cookies.set("lm_access_token", accessToken, accessCookieOptions);
  response.cookies.set("lm_refresh_token", refreshToken, {
    ...refreshCookieOptions,
    path: "/api/auth",
  });

  return response;
}

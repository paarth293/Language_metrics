import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRefreshToken, signSession, signRefreshToken, accessCookieOptions, refreshCookieOptions } from "@/lib/auth";
import { verifyRefreshSession, rotateRefreshSession } from "@/lib/redis-session";
import { db } from "@repo/database";

/**
 * GET /api/auth/refresh
 *
 * Rotates the refresh token and issues a new access token.
 * Optionally redirects to the `next` URL if provided.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nextPath = searchParams.get("next") ?? "/dashboard";
  const refreshToken = request.cookies.get("lm_admin_refresh_token")?.value;

  const failRedirectUrl = new URL("/login", request.url);
  failRedirectUrl.searchParams.set("error", "session_expired");
  failRedirectUrl.searchParams.set("next", nextPath);

  const failResponse = NextResponse.redirect(failRedirectUrl);
  failResponse.cookies.set("lm_admin_access_token", "", { maxAge: 0, path: "/" });
  failResponse.cookies.set("lm_admin_refresh_token", "", { maxAge: 0, path: "/api/auth" });

  if (!refreshToken) {
    return failResponse;
  }

  // 1. Verify JWT signature + expiry
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload?.sub || !payload?.sid) {
    return failResponse;
  }

  // 2. Verify against Redis (checks for revocation / reuse)
  const sessionData = await verifyRefreshSession(payload.sub, payload.sid);
  if (!sessionData) {
    // Potential token reuse / stolen token detected.
    console.warn(`[Auth] Rejected refresh token for user ${payload.sub} — session missing from Redis.`);
    return failResponse;
  }

  // 3. Look up user to ensure they are still active and an admin
  const admin = await db.adminUser.findUnique({
    where: { userId: payload.sub },
    select: { userId: true, email: true, roleKey: true, isSuperAdmin: true, status: true },
  });

  if (!admin || admin.status !== "ACTIVE") {
    return failResponse;
  }

  // 4. Generate new tokens
  const newSessionId = crypto.randomUUID();
  const [newAccessToken, newRefreshToken] = await Promise.all([
    signSession({
      sub: admin.userId,
      email: admin.email,
      roleKey: admin.roleKey,
      isSuperAdmin: admin.isSuperAdmin,
    }),
    signRefreshToken(admin.userId, newSessionId),
  ]);

  // 5. Atomically rotate the session in Redis
  const rotated = await rotateRefreshSession(
    admin.userId,
    payload.sid,
    newSessionId,
    {
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      ua: request.headers.get("user-agent") ?? undefined,
    }
  );

  if (!rotated) {
    // Race condition or reuse detected between check and rotate
    return failResponse;
  }

  // 6. Return new cookies and redirect
  const successUrl = new URL(nextPath, request.url);
  const successResponse = NextResponse.redirect(successUrl);

  successResponse.cookies.set("lm_admin_access_token", newAccessToken, accessCookieOptions);
  successResponse.cookies.set("lm_admin_refresh_token", newRefreshToken, refreshCookieOptions);

  return successResponse;
}

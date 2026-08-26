import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  verifyRefreshToken,
  signAccessToken,
  signRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/tokens";
import { rotateRefreshSession, revokeAllRefreshSessions } from "@/lib/redis-session";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

/**
 * GET /api/auth/silent-refresh?next=/some/path
 *
 * Called by the middleware when the access token is expired but a refresh token
 * cookie is present. This is a GET endpoint so it can be the target of a browser
 * redirect from the middleware.
 *
 * Flow:
 *  1. Verify refresh token cookie (RS256 signature + expiry).
 *  2. Rotate session in Redis atomically.
 *     If old session key is missing => possible theft => revoke all sessions.
 *  3. Fetch user from DB to get current role.
 *  4. Issue new access + refresh token cookies.
 *  5. Redirect to originally requested URL (next param).
 */
export async function GET(request: NextRequest) {
  const next = request.nextUrl.searchParams.get("next") ?? "/";
  // Ensure next is a safe relative path, not an open redirect
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const refreshToken = request.cookies.get("lm_refresh_token")?.value;

  if (!refreshToken) {
    const loginUrl = new URL("/login", APP_URL);
    loginUrl.searchParams.set("next", safeNext);
    return NextResponse.redirect(loginUrl);
  }

  // 1. Verify refresh token
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload?.sub || !payload?.sid) {
    const loginUrl = new URL("/login", APP_URL);
    loginUrl.searchParams.set("next", safeNext);
    loginUrl.searchParams.set("reason", "session_expired");
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
    return res;
  }

  const userId = payload.sub;
  const oldSessionId = payload.sid;
  const newSessionId = crypto.randomUUID();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ua = request.headers.get("user-agent") ?? undefined;

  // 2. Rotate session atomically
  const rotated = await rotateRefreshSession(userId, oldSessionId, newSessionId, {
    ip: ip ?? undefined,
    ua,
  });

  if (!rotated) {
    // Potential token theft - revoke all sessions and force re-login
    await revokeAllRefreshSessions(userId).catch(() => {});
    console.error(
      `[SilentRefresh] Rotation failed for userId=${userId}. Possible token theft. All sessions revoked.`
    );
    const loginUrl = new URL("/login", APP_URL);
    loginUrl.searchParams.set("reason", "security");
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
    return res;
  }

  // 3. Fetch user for current role
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    const loginUrl = new URL("/login", APP_URL);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
    return res;
  }

  // 4. Issue new tokens
  const [newAccessToken, newRefreshToken] = await Promise.all([
    signAccessToken(user.id, user.role),
    signRefreshToken(user.id, newSessionId),
  ]);

  // 5. Redirect to original destination with new cookies
  const destination = new URL(safeNext, APP_URL);
  const res = NextResponse.redirect(destination);
  res.cookies.set("lm_access_token", newAccessToken, accessCookieOptions);
  res.cookies.set("lm_refresh_token", newRefreshToken, {
    ...refreshCookieOptions,
    path: "/api/auth",
  });

  return res;
}

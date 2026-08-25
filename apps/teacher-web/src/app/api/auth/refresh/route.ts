import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRefreshToken, signAccessToken, signRefreshToken, accessCookieOptions, refreshCookieOptions } from "@/lib/tokens";
import { rotateRefreshSession } from "@/lib/redis-session";

/**
 * POST /api/auth/refresh
 *
 * Silently refreshes the access token using the refresh token cookie.
 * Implements refresh token rotation — old session is invalidated, new one created.
 *
 * If the old sessionId is not found in Redis (already used or revoked),
 * we treat it as a potential token theft and clear all cookies.
 */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("lm_refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ message: "No refresh token." }, { status: 401 });
  }

  // Verify the refresh token signature + expiry
  const payload = await verifyRefreshToken(refreshToken);
  if (!payload || !payload.sub || !payload.sid) {
    const res = NextResponse.json({ message: "Invalid refresh token." }, { status: 401 });
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
    return res;
  }

  const userId = payload.sub;
  const oldSessionId = payload.sid;
  const newSessionId = crypto.randomUUID();

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ua = request.headers.get("user-agent") ?? undefined;

  // Rotate session in Redis — deletes old, creates new atomically
  const rotated = await rotateRefreshSession(userId, oldSessionId, newSessionId, {
    ip: ip ?? undefined,
    ua,
  });

  if (!rotated) {
    // Old session not found → possible token reuse/theft. Clear all cookies.
    const res = NextResponse.json(
      { message: "Session not found. Please log in again." },
      { status: 401 }
    );
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
    return res;
  }

  // We need the user's role to sign a new access token.
  // The refresh token doesn't carry the role (intentionally minimal).
  // Fetch it from the DB.
  const { db } = await import("@/lib/db");
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true, email: true, studentProfile: { select: { name: true } }, teacherProfile: { select: { name: true } } },
  });

  if (!user) {
    const res = NextResponse.json({ message: "User not found." }, { status: 401 });
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    res.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
    return res;
  }

  const [newAccessToken, newRefreshToken] = await Promise.all([
    signAccessToken(user.id, user.role),
    signRefreshToken(user.id, newSessionId),
  ]);

  const name = user.studentProfile?.name ?? user.teacherProfile?.name ?? "User";

  const response = NextResponse.json(
    { user: { id: user.id, name, email: user.email, role: user.role } },
    { status: 200 }
  );

  response.cookies.set("lm_access_token", newAccessToken, accessCookieOptions);
  response.cookies.set("lm_refresh_token", newRefreshToken, {
    ...refreshCookieOptions,
    path: "/api/auth",
  });

  return response;
}

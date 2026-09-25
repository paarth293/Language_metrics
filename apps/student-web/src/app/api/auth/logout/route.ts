import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRefreshToken } from "@/lib/tokens";
import { revokeRefreshSession } from "@/lib/redis-session";
import { rateLimitRedis } from "@/lib/rate-limit";

/**
 * POST /api/auth/logout
 * Revokes the refresh token and clears cookies.
 */
export async function POST(request: NextRequest) {
  // Logout doesn't need a strict limit (it's not a credential-guessing
  // target the way login is), but it's an unauthenticated-by-cookie-only
  // endpoint reachable by anyone, so a light per-IP limit avoids it being
  // usable to hammer Redis for free.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isLimited = await rateLimitRedis(ip, "logout", { windowMs: 60_000, max: 30 });
  if (isLimited) {
    return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
  }

  const refreshToken = request.cookies.get("lm_refresh_token")?.value;

  if (refreshToken) {
    const payload = await verifyRefreshToken(refreshToken);
    if (payload?.sub && payload?.sid) {
      await revokeRefreshSession(payload.sub, payload.sid).catch(() => {});
    }
  }

  const response = NextResponse.json({ success: true }, { status: 200 });
  response.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
  response.cookies.set("lm_refresh_token", "", { maxAge: 0, path: "/api/auth" });
  return response;
}

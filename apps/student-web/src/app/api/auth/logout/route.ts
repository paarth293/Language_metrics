import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyRefreshToken } from "@/lib/tokens";
import { revokeRefreshSession } from "@/lib/redis-session";

/**
 * POST /api/auth/logout
 * Revokes the refresh token and clears cookies.
 */
export async function POST(request: NextRequest) {
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

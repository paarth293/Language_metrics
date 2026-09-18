import { NextRequest, NextResponse } from "next/server";
import { verifyRefreshToken } from "@/lib/tokens";
import { revokeRefreshSession } from "@/lib/redis-session";
import { MobileLogoutRequestSchema } from "@repo/api-contracts";

/**
 * POST /api/v1/auth/mobile/logout
 *
 * Explicitly revokes the mobile refresh session from Redis.
 */
export async function POST(request: NextRequest) {
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Body is optional
  }

  const parseResult = MobileLogoutRequestSchema.safeParse(body);
  const refreshToken = parseResult.success ? parseResult.data.refreshToken : undefined;

  if (refreshToken) {
    try {
      const payload = await verifyRefreshToken(refreshToken);
      if (payload?.sub && payload?.sid) {
        await revokeRefreshSession(payload.sub, payload.sid);
      }
    } catch {
      // Ignored: Logout always succeeds gracefully
    }
  }

  return NextResponse.json({ success: true, message: "Logged out successfully." }, { status: 200 });
}

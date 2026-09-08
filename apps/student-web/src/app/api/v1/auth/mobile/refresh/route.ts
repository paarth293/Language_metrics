import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from "@/lib/tokens";
import { rotateRefreshSession } from "@/lib/redis-session";
import { rateLimitRedis } from "@/lib/rate-limit";
import {
  RefreshTokenRequestSchema,
  MobileTokenResponseSchema,
  type MobileTokenResponse,
} from "@repo/api-contracts";

/**
 * POST /api/v1/auth/mobile/refresh
 *
 * Atomically rotates the refresh token session and issues a fresh Bearer access token.
 */
export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isLimited = await rateLimitRedis(ip, "mobile-refresh", { windowMs: 60_000, max: 30 });
  if (isLimited) {
    return NextResponse.json({ message: "Too many refresh attempts. Please slow down." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parseResult = RefreshTokenRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: "Validation error", errors: parseResult.error.issues },
      { status: 400 }
    );
  }
  const { refreshToken } = parseResult.data;

  try {
    const payload = await verifyRefreshToken(refreshToken);
    if (!payload || !payload.sub || !payload.sid) {
      return NextResponse.json({ message: "Invalid or expired refresh token." }, { status: 401 });
    }

    const userId = payload.sub;
    const oldSessionId = payload.sid;

    // Check user in database
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { studentProfile: true },
    });

    if (!user || user.role !== "STUDENT") {
      return NextResponse.json({ message: "Account not found or unauthorized." }, { status: 401 });
    }

    if (user.studentProfile?.status === "SUSPENDED" || user.studentProfile?.status === "BLOCKED") {
      return NextResponse.json(
        { message: "This student account is suspended." },
        { status: 403 }
      );
    }

    // Atomic rotation in Redis: old session deleted, new session created
    const newSessionId = crypto.randomUUID();
    const rotated = await rotateRefreshSession(userId, oldSessionId, newSessionId, {
      ip,
      ua: request.headers.get("user-agent") ?? undefined,
    });

    if (!rotated) {
      // Possible token reuse or session already revoked
      return NextResponse.json(
        { message: "Session expired or revoked. Please log in again." },
        { status: 401 }
      );
    }

    const [newAccessToken, newRefreshToken] = await Promise.all([
      signAccessToken(user.id, user.role, user.emailVerified),
      signRefreshToken(user.id, newSessionId),
    ]);

    const responsePayload: MobileTokenResponse = {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      tokenType: "Bearer",
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      user: {
        id: user.id,
        email: user.email,
        name: user.studentProfile?.name ?? "Student",
        role: "STUDENT",
        avatarUrl: user.studentProfile?.avatarUrl ?? null,
      },
    };

    const validated = MobileTokenResponseSchema.parse(responsePayload);
    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error("[Mobile Auth] Refresh error:", error);
    return NextResponse.json({ message: "Internal server error during token refresh." }, { status: 500 });
  }
}

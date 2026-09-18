import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  signAccessToken,
  signRefreshToken,
  ACCESS_TOKEN_TTL_SECONDS,
} from "@/lib/tokens";
import { storeRefreshSession } from "@/lib/redis-session";
import { rateLimitRedis, exceedsMaxBodySize } from "@/lib/rate-limit";
import {
  MobileLoginRequestSchema,
  MobileTokenResponseSchema,
  type MobileTokenResponse,
} from "@repo/api-contracts";

/**
 * POST /api/v1/auth/mobile/login
 *
 * Mobile authentication endpoint.
 * Returns RS256 Bearer access token and Redis-tracked refresh token as JSON.
 */
export async function POST(request: NextRequest) {
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isLimited = await rateLimitRedis(ip, "mobile-login", { windowMs: 60_000, max: 10 });
  if (isLimited) {
    return NextResponse.json({ message: "Too many login attempts. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const parseResult = MobileLoginRequestSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: "Validation error", errors: parseResult.error.issues },
      { status: 400 }
    );
  }
  const { email, password } = parseResult.data;

  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { studentProfile: true },
    });

    // Constant-time failure response to prevent user enumeration
    if (!user || !user.passwordHash || user.role !== "STUDENT") {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ message: "Email not verified. Please verify your email before logging in." }, { status: 403 });
    }

    if (user.studentProfile?.status === "SUSPENDED" || user.studentProfile?.status === "BLOCKED") {
      return NextResponse.json(
        { message: "This student account is suspended. Please contact support." },
        { status: 403 }
      );
    }

    const sessionId = crypto.randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user.id, user.role, true),
      signRefreshToken(user.id, sessionId),
    ]);

    await storeRefreshSession(user.id, sessionId, {
      ip,
      ua: request.headers.get("user-agent") ?? undefined,
    });

    const responsePayload: MobileTokenResponse = {
      accessToken,
      refreshToken,
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

    // Strict validation against shared contract
    const validated = MobileTokenResponseSchema.parse(responsePayload);
    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error("[Mobile Auth] Login error:", error);
    return NextResponse.json({ message: "Internal server error during authentication." }, { status: 500 });
  }
}

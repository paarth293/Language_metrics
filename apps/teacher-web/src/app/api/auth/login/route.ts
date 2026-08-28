import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AuthService } from "@/features/auth/services/auth-service";
import { loginSchema } from "@/features/auth/validators/auth";
import { rateLimit, rateLimitRedis, exceedsMaxBodySize } from "@/lib/rate-limit";
import {
  signAccessToken,
  signRefreshToken,
  accessCookieOptions,
  refreshCookieOptions,
} from "@/lib/tokens";
import { storeRefreshSession } from "@/lib/redis-session";

/**
 * POST /api/auth/login
 * Body: { email, password, role? }
 *
 * Security layers:
 *  1. Body size guard
 *  2. Rate limiter — 10 attempts per IP per minute
 *  3. Zod strict schema validation
 *  4. AuthService — constant-time bcrypt comparison + email verification check
 *  5. Issues httpOnly access + refresh token cookies (no token in response body)
 */
export async function POST(request: NextRequest) {
  // 1. Body size guard
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  // 2. Rate limiting — 10 attempts per IP per 60s (Redis sliding window)
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isLimited = await rateLimitRedis(ip, "login", { windowMs: 60_000, max: 10 });
  if (isLimited) {
    return NextResponse.json(
      { message: "Too many login attempts. Please wait 60 seconds and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  // 3. Parse + validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const result = loginSchema.safeParse(body);
  if (!result.success) {
    const message = result.error.issues[0]?.message ?? "Invalid inputs.";
    return NextResponse.json({ message }, { status: 400 });
  }

  // 4. Authenticate + 5. Issue tokens
  try {
    const authResult = await AuthService.login(result.data);
    if ("error" in authResult) {
      if (authResult.error === "UNVERIFIED_EMAIL") {
        return NextResponse.json(
          { error: "UNVERIFIED_EMAIL", message: "Please verify your email address." },
          { status: 403 }
        );
      }
      if (authResult.error === "USER_NOT_FOUND") {
        return NextResponse.json({ message: "USER_NOT_FOUND" }, { status: 404 });
      }
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    // Issue tokens — httpOnly cookies only, never in response body
    const sessionId = crypto.randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(authResult.user.id, authResult.user.role, true), // email verified — checked above
      signRefreshToken(authResult.user.id, sessionId),
    ]);

    await storeRefreshSession(authResult.user.id, sessionId, {
      ip,
      ua: request.headers.get("user-agent") ?? undefined,
    });

    const response = NextResponse.json(
      { user: authResult.user },
      { status: 200 }
    );

    response.cookies.set("lm_access_token", accessToken, accessCookieOptions);
    response.cookies.set("lm_refresh_token", refreshToken, {
      ...refreshCookieOptions,
      // Allow the refresh token cookie to reach /api/auth routes
      path: "/api/auth",
    });

    return response;
  } catch (err: unknown) {
    console.error("POST /api/auth/login error:", err);
    // Distinguish between database connectivity issues and other errors
    const errObj = err instanceof Error ? err : new Error(String(err));
    const message = errObj.message;
    if (message.includes("database server") || message.includes("ECONNREFUSED") || message.includes("ETIMEOUT") || message.includes("Can't reach")) {
      return NextResponse.json(
        { message: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    if (message.includes("REDIS_URL") || message.includes("Redis")) {
      return NextResponse.json(
        { message: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}

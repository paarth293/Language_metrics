import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken, accessCookieOptions, refreshCookieOptions } from "@/lib/tokens";
import { storeRefreshSession } from "@/lib/redis-session";
import { rateLimitRedis, exceedsMaxBodySize } from "@/lib/rate-limit";
import { validateLoginBody } from "@/lib/validation";

/**
 * POST /api/auth/login
 * Body: { email, password, role? }
 */
export async function POST(request: NextRequest) {
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const isLimited = await rateLimitRedis(ip, "login", { windowMs: 60_000, max: 10 });
  if (isLimited) {
    return NextResponse.json({ message: "Too many login attempts." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateLoginBody(body);
  if (!validation.ok) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: validation.errors[0], errors: validation.errors },
      { status: 400 }
    );
  }
  const { email, password, role } = validation.data;

  try {
    const user = await db.user.findUnique({
      where: { email },
      include: { studentProfile: true },
    });

    // SECURITY FIX (was: 404 "USER_NOT_FOUND"): returning a distinct
    // status/message when the email doesn't exist lets an attacker enumerate
    // registered accounts by checking which emails return 404 vs 401. Every
    // credential failure below — unknown email, no password set, wrong role,
    // wrong password — now returns the exact same 401 + generic message, so
    // none of them leak whether the email is registered.
    if (!user || !user.passwordHash || (role && user.role !== role)) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: "Invalid email or password." }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ message: "UNVERIFIED_EMAIL" }, { status: 403 });
    }

    // SECURITY FIX: request-deletion/route.ts sets studentProfile.status to
    // "SUSPENDED" and admin tooling can set it to "SUSPENDED" or "BLOCKED",
    // but nothing in the auth flow ever read that field back — this is a
    // stateless JWT setup, so requireAuth() (lib/auth.ts) only checks the
    // token's signature/expiry/role on every request, never the DB. That
    // meant a suspended or blocked student could still log in normally and
    // mint a brand-new access+refresh token pair at any time, making both
    // "suspend" and "request deletion" no-ops the moment the student tried
    // again. Login is the one place in this flow that already hits the DB
    // before issuing tokens, so it's the right place to enforce this.
    if (user.studentProfile?.status === "SUSPENDED" || user.studentProfile?.status === "BLOCKED") {
      return NextResponse.json(
        { message: "This account is suspended. Contact support for assistance." },
        { status: 403 }
      );
    }

    const sessionId = crypto.randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user.id, user.role, true),
      signRefreshToken(user.id, sessionId),
    ]);

    await storeRefreshSession(user.id, sessionId, { ip, ua: request.headers.get("user-agent") ?? undefined });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          name: user.studentProfile?.name ?? "Student",
          email: user.email,
          role: user.role,
          emailVerified: user.emailVerified,
        },
      },
      { status: 200 }
    );

    // Use standardized cookie options from tokens.ts
    response.cookies.set("lm_access_token", accessToken, accessCookieOptions);
    response.cookies.set("lm_refresh_token", refreshToken, refreshCookieOptions);

    return response;
  } catch (err) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json({ message: "An unexpected error occurred." }, { status: 500 });
  }
}

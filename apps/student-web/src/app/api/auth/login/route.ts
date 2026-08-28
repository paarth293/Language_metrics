import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { signAccessToken, signRefreshToken, accessCookieOptions, refreshCookieOptions } from "@/lib/tokens";
import { storeRefreshSession } from "@/lib/redis-session";
import { rateLimitRedis, exceedsMaxBodySize } from "@/lib/rate-limit";

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

  const { email, password, role } = body as { email?: string; password?: string; role?: string };
  if (!email || !password) {
    return NextResponse.json({ message: "Email and password are required." }, { status: 400 });
  }

  try {
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { studentProfile: true },
    });

    if (!user) {
      return NextResponse.json({ message: "USER_NOT_FOUND" }, { status: 404 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    if (role && user.role !== role) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    if (!user.emailVerified) {
      return NextResponse.json({ message: "UNVERIFIED_EMAIL" }, { status: 403 });
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

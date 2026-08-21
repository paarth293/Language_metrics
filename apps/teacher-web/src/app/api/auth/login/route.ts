import { NextResponse } from "next/server";

import { AuthService } from "@/features/auth/services/auth-service";
import { loginSchema } from "@/features/auth/validators/auth";
import { rateLimit, exceedsMaxBodySize } from "@/lib/rate-limit";

/**
 * POST /api/auth/login
 * Body: { email, password }
 *
 * Security layers (in order):
 *  1. Body size guard — rejects before JSON.parse if body > 16 KB
 *  2. Rate limiter — max 10 login attempts per IP per minute
 *  3. Zod strict schema — rejects unknown fields + validates shape/types
 *  4. AuthService — constant-time bcrypt comparison (timing-safe)
 */


export async function POST(request: Request) {
  // 1. Body size guard
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  // 2. Rate limiting — 10 attempts per IP per 60 s
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 60_000, max: 10 })) {
    return NextResponse.json(
      { message: "Too many login attempts. Please wait 60 seconds and try again." },
      { status: 429, headers: { "Retry-After": "60" } }
    );
  }

  try {
    // 3. Parse body safely — malformed JSON is caught here
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    // 4. Zod validation — .strict() means extra keys like `role:"admin"` are rejected
    const result = loginSchema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid inputs.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const authResult = await AuthService.login(result.data);
    if (!authResult) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    return NextResponse.json(authResult, { status: 200 });
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}


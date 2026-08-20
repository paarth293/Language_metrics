import { NextResponse } from "next/server";
import { AuthService } from "@/features/auth/services/auth-service";
import { registerStudentSchema } from "@/features/auth/validators/auth";
import { rateLimit, exceedsMaxBodySize } from "@/lib/rate-limit";

/**
 * POST /api/auth/register/student
 * Body: { name, email, password, languageToLearn, proficiencyLevel? }
 *
 * Security layers (in order):
 *  1. Body size guard — rejects before JSON.parse if body > 16 KB
 *  2. Rate limiter — max 5 registration attempts per IP per 10 minutes
 *  3. Zod strict schema — rejects unknown fields, validates shape/types,
 *     enforces name character class (no HTML/script injection)
 *  4. AuthService — hashes password with bcrypt before writing to DB
 */
export async function POST(request: Request) {
  // 1. Body size guard
  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  // 2. Rate limiting — stricter for registration: 5 per IP per 10 minutes
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimit(ip, { windowMs: 10 * 60_000, max: 5 })) {
    return NextResponse.json(
      { message: "Too many registration attempts. Please wait 10 minutes." },
      { status: 429, headers: { "Retry-After": "600" } }
    );
  }

  try {
    // 3. Parse body safely
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
    }

    // 4. Zod validation (.strict() rejects unknown fields, nameSchema blocks XSS)
    const result = registerStudentSchema.safeParse(body);
    if (!result.success) {
      const message = result.error.issues[0]?.message ?? "Invalid inputs.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const authResult = await AuthService.registerStudent(result.data);
    if (!authResult) {
      return NextResponse.json({ message: "Email already in use." }, { status: 409 });
    }

    return NextResponse.json(authResult, { status: 201 });
  } catch (err) {
    console.error("registerStudent error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { AuthService } from "@/services/auth-service";
import { loginSchema } from "@/validators/auth";

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = loginSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues[0]?.message || "Invalid inputs.";
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

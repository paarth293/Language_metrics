import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AuthService } from "@/features/auth/services/auth-service";
import { registerTeacherSchema } from "@/features/auth/validators/auth";

/**
 * POST /api/auth/register/teacher
 * Body: { name, email, password, experienceType }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerTeacherSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues[0]?.message || "Invalid inputs.";
      return NextResponse.json({ message }, { status: 400 });
    }

    const authResult = await AuthService.registerTeacher(result.data);
    if (!authResult) {
      return NextResponse.json({ message: "Email already in use." }, { status: 409 });
    }

    return NextResponse.json(authResult, { status: 201 });
  } catch (err) {
    console.error("registerTeacher error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

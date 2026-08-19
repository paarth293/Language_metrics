import { NextResponse } from "next/server";
import { AuthService } from "@/features/auth/services/auth-service";
import { registerStudentSchema } from "@/features/auth/validators/auth";

/**
 * POST /api/auth/register/student
 * Body: { name, email, password, languageToLearn, proficiencyLevel? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = registerStudentSchema.safeParse(body);

    if (!result.success) {
      const message = result.error.issues[0]?.message || "Invalid inputs.";
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

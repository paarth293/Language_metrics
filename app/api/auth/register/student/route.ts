import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/server/jwt";
import { validateRegisterStudent } from "@/lib/server/validators";

/**
 * POST /api/auth/register/student
 * Body: { name, email, password, languageToLearn, proficiencyLevel? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, languageToLearn, proficiencyLevel = "beginner" } = body ?? {};

    const validationError = validateRegisterStudent({ name, email, password, languageToLearn });
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ message: "Email already in use." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "STUDENT",
        student: { create: { languageToLearn, proficiencyLevel } },
      },
    });

    const token = signToken(user.id, user.role);
    return NextResponse.json(
      { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      { status: 201 }
    );
  } catch (err) {
    console.error("registerStudent error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { signToken } from "@/lib/server/jwt";
import { validateLogin } from "@/lib/server/validators";

/**
 * POST /api/auth/login
 * Body: { email, password }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    const validationError = validateLogin({ email, password });
    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json({ message: "Invalid credentials." }, { status: 401 });
    }

    const token = signToken(user.id, user.role);
    return NextResponse.json(
      { token, user: { id: user.id, name: user.name, email: user.email, role: user.role } },
      { status: 200 }
    );
  } catch (err) {
    console.error("login error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

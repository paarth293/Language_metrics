import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/server/authGuard";

/**
 * GET /api/teachers/me
 * Returns the authenticated teacher's profile (including verification status).
 */
export async function GET(request: Request) {
  const auth = requireRole(request, "TEACHER");
  if (auth.response) return auth.response;

  try {
    const teacher = await prisma.teacher.findUnique({
      where: { userId: auth.user.userId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });

    if (!teacher) {
      return NextResponse.json({ message: "Teacher profile not found." }, { status: 404 });
    }

    return NextResponse.json({ teacher }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (teacher) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

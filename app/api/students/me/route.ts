import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/server/authGuard";

/**
 * GET /api/students/me
 * Returns the authenticated student's profile.
 */
export async function GET(request: Request) {
  const auth = requireRole(request, "STUDENT");
  if (auth.response) return auth.response;

  try {
    const student = await prisma.student.findUnique({
      where: { userId: auth.user.userId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });

    if (!student) {
      return NextResponse.json({ message: "Student profile not found." }, { status: 404 });
    }

    return NextResponse.json({ student }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (student) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

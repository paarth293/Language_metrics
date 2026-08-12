import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { StudentService } from "@/services/student-service";

/**
 * GET /api/students/me
 * Returns the authenticated student's profile.
 */
export async function GET(request: Request) {
  const auth = requireRole(request, "STUDENT");
  if (auth.response) return auth.response;

  try {
    const student = await StudentService.getProfile(auth.user.userId);
    if (!student) {
      return NextResponse.json({ message: "Student profile not found." }, { status: 404 });
    }

    return NextResponse.json({ student }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (student) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

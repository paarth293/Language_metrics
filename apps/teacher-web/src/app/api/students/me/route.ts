import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { StudentService } from "@/features/services/student-service";

/**
 * GET /api/students/me
 * Returns the authenticated student's profile.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const student = await StudentService.getProfile(auth.user.sub);
    if (!student) {
      return NextResponse.json({ message: "Student profile not found." }, { status: 404 });
    }

    return NextResponse.json({ student }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (student) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

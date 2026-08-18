import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/me
 * Returns the authenticated teacher's profile.
 */
export async function GET(request: Request) {
  const auth = requireRole(request, "TEACHER");
  if (auth.response) return auth.response;

  try {
    const teacher = await TeacherService.getProfileByUserId(auth.user.userId);
    if (!teacher) {
      return NextResponse.json({ message: "Teacher profile not found." }, { status: 404 });
    }

    return NextResponse.json({ teacher }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (teacher) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

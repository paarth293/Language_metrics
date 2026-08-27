import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/me
 * Returns the authenticated teacher's profile.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const teacher = await TeacherService.getProfileByUserId(auth.user.sub);
    if (!teacher) {
      return NextResponse.json({ message: "Teacher profile not found." }, { status: 404 });
    }

    return NextResponse.json({ teacher }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (teacher) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

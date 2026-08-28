import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/students
 * Returns the list of students the teacher has taught.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const students = await TeacherService.getStudents(auth.user.sub);
    return NextResponse.json({ students }, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/students error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

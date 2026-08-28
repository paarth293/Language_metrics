import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/dashboard
 * Returns the dashboard data for the authenticated teacher.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const data = await TeacherService.getDashboardData(auth.user.sub);
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/dashboard error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

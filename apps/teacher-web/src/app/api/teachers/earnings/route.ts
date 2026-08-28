import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/earnings
 * Returns earnings summary, payout history, and coin transactions.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const earnings = await TeacherService.getEarnings(auth.user.sub);
    return NextResponse.json(earnings, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/earnings error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

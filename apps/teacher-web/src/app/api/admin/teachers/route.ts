import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";
import type { VerificationStatus } from "@repo/database";

const VALID_STATUSES: VerificationStatus[] = ["PENDING", "APPROVED", "REJECTED"];

/**
 * GET /api/admin/teachers?status=PENDING
 * Lists teachers for the admin verification queue. Optional status filter.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "ADMIN");
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status")?.toUpperCase();
    const status =
      statusParam && VALID_STATUSES.includes(statusParam as VerificationStatus)
        ? (statusParam as VerificationStatus)
        : undefined;

    const listResult = await TeacherService.listTeachersForAdmin(status);
    return NextResponse.json(listResult, { status: 200 });
  } catch (err) {
    console.error("admin listTeachers error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

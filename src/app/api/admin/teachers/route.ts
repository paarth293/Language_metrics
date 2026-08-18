import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";
import type { TeacherStatus } from "@prisma/client";

const VALID_STATUSES: TeacherStatus[] = ["pending", "approved", "rejected"];

/**
 * GET /api/admin/teachers?status=pending
 * Lists teachers for the admin verification queue. Optional status filter.
 */
export async function GET(request: Request) {
  const auth = requireRole(request, "ADMIN");
  if (auth.response) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const status =
      statusParam && VALID_STATUSES.includes(statusParam as TeacherStatus)
        ? (statusParam as TeacherStatus)
        : undefined;

    const listResult = await TeacherService.listTeachersForAdmin(status);
    return NextResponse.json(listResult, { status: 200 });
  } catch (err) {
    console.error("admin listTeachers error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { requireRole } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";
import type { VerificationStatus } from "@prisma/client";

const ACTIONABLE_STATUSES: VerificationStatus[] = ["APPROVED", "REJECTED", "PENDING"];

/**
 * PATCH /api/admin/teachers/[id]
 * Body: { status: "APPROVED" | "REJECTED" | "PENDING" }
 * Updates a teacher's verification status. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, "ADMIN");
  if (auth.response) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const status = body?.status?.toUpperCase() as VerificationStatus | undefined;

    if (!status || !ACTIONABLE_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: "A valid status (APPROVED, REJECTED, or PENDING) is required." },
        { status: 400 }
      );
    }

    const existing = await TeacherService.findById(id);
    if (!existing) {
      return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
    }

    const teacher = await TeacherService.updateVerificationStatus(id, status);

    return NextResponse.json({ teacher }, { status: 200 });
  } catch (err) {
    console.error("admin updateTeacherStatus error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

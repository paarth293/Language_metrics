import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { requireApiAdmin } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";

// Teacher status transitions performed by admin. Approving/rejecting is
// privileged and fully audited. Only PENDING -> APPROVED/REJECTED is allowed
// here; suspension uses a separate guarded route.

const VALID_STATUSES = ["APPROVED", "REJECTED"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request, "teachers:manage");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.status !== "string" || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ message: "Invalid status." }, { status: 400 });
  }

  const teacher = await db.teacherProfile.findUnique({ where: { userId: id } });
  if (!teacher) {
    return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
  }
  if (teacher.status !== "PENDING") {
    return NextResponse.json({ message: "Only pending teachers can be approved or rejected." }, { status: 400 });
  }

  await db.teacherProfile.update({
    where: { userId: id },
    data: { status: body.status },
  });

  await auditLog(
    { adminId: auth.admin.id },
    body.status === "APPROVED" ? "APPROVE_TEACHER" : "REJECT_TEACHER",
    id,
    { teacherId: id }
  );

  return NextResponse.json({ ok: true, status: body.status });
}

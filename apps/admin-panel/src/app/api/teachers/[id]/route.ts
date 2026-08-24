import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { requireApiAdmin } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";
import { teacherStatusSchema, parseBody } from "@/lib/validators";

// Teacher status transitions performed by admin. Approving/rejecting is
// privileged and fully audited. Only PENDING -> APPROVED/REJECTED is allowed
// here; suspension uses a separate guarded route.

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request, "teachers:manage");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parseBody(teacherStatusSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
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
    data: { status: parsed.data.status },
  });

  const h = request.headers;
  const ctx = {
    adminId: auth.admin.id,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };

  await auditLog(
    ctx,
    parsed.data.status === "APPROVED" ? "APPROVE_TEACHER" : "REJECT_TEACHER",
    id,
    { teacherId: id }
  );

  return NextResponse.json({ ok: true, status: parsed.data.status });
}

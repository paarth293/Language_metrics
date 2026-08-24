import { NextResponse } from "next/server";
import { db } from "@repo/database";
import { requireApiAdmin } from "@/lib/api-auth";
import { auditLog, recordSecurityEvent } from "@/lib/audit";
import { teacherActionSchema, parseBody } from "@/lib/validators";

// Suspending / reactivating / banning a teacher. Highly privileged action.
// Every call is audited against the acting admin and recorded as a security
// event for the Security & Monitoring view.

const ACTIONS: Record<string, string> = {
  suspend: "SUSPEND_TEACHER",
  reactivate: "REACTIVATE_TEACHER",
  ban: "BAN_TEACHER",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiAdmin(request, "teachers:manage");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const parsed = parseBody(teacherActionSchema, body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error }, { status: 400 });
  }

  const action = parsed.data.action;

  const teacher = await db.teacherProfile.findUnique({ where: { userId: id } });
  if (!teacher) {
    return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
  }

  // Suspension is represented by moving the teacher out of the active pool.
  // We do not mutate the linked User's role, which would corrupt other flows.
  const newStatus = action === "suspend" || action === "ban" ? "REJECTED" : "PENDING";
  await db.teacherProfile.update({ where: { userId: id }, data: { status: newStatus } });

  const h = request.headers;
  const ctx = {
    adminId: auth.admin.id,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null,
    userAgent: h.get("user-agent") ?? null,
  };

  await auditLog(ctx, ACTIONS[action]!, id, { teacherId: id });
  await recordSecurityEvent(
    action === "ban" ? "ACCOUNT_BANNED" : action === "suspend" ? "ACCOUNT_SUSPENDED" : "ACCOUNT_REACTIVATED",
    action === "ban" ? "CRITICAL" : "WARN",
    { teacherId: id, teacherName: teacher.name },
    auth.admin.id,
    ctx.ip
  );

  return NextResponse.json({ ok: true, action });
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/server/authGuard";
import type { TeacherStatus } from "@prisma/client";

const ACTIONABLE_STATUSES: TeacherStatus[] = ["approved", "rejected", "pending"];

/**
 * PATCH /api/admin/teachers/[id]
 * Body: { status: "approved" | "rejected" | "pending" }
 * Updates a teacher's verification status. Admin only.
 */
export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/admin/teachers/[id]">
) {
  const auth = requireRole(request, "ADMIN");
  if (auth.response) return auth.response;

  try {
    const { id } = await ctx.params;
    const body = await request.json();
    const status = body?.status as TeacherStatus | undefined;

    if (!status || !ACTIONABLE_STATUSES.includes(status)) {
      return NextResponse.json(
        { message: "A valid status (approved, rejected, or pending) is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.teacher.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "Teacher not found." }, { status: 404 });
    }

    const teacher = await prisma.teacher.update({
      where: { id },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });

    return NextResponse.json({ teacher }, { status: 200 });
  } catch (err) {
    console.error("admin updateTeacherStatus error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

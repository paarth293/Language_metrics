import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/server/authGuard";
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

    const teachers = await prisma.teacher.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { user: { createdAt: "desc" } },
    });

    const counts = await prisma.teacher.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const summary = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const c of counts) {
      summary[c.status] = c._count._all;
      summary.total += c._count._all;
    }

    return NextResponse.json({ teachers, summary }, { status: 200 });
  } catch (err) {
    console.error("admin listTeachers error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

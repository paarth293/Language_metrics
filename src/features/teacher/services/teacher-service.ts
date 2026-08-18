import { db } from "@/lib/db";
import type { TeacherStatus } from "@prisma/client";

export class TeacherService {
  static async getProfileByUserId(userId: string) {
    return db.teacher.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }

  static async findById(id: string) {
    return db.teacher.findUnique({
      where: { id },
    });
  }

  static async listTeachersForAdmin(status?: TeacherStatus) {
    const teachers = await db.teacher.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
      orderBy: { user: { createdAt: "desc" } },
    });

    const counts = await db.teacher.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const summary = { pending: 0, approved: 0, rejected: 0, total: 0 };
    for (const c of counts) {
      summary[c.status] = c._count._all;
      summary.total += c._count._all;
    }

    return { teachers, summary };
  }

  static async updateVerificationStatus(id: string, status: TeacherStatus) {
    return db.teacher.update({
      where: { id },
      data: { status },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }
}
export default TeacherService;

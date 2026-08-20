import { db } from "@/lib/db";
import type { VerificationStatus } from "@repo/database";

export class TeacherService {
  static async getProfileByUserId(userId: string) {
    const profile = await db.teacherProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, createdAt: true } } },
    });

    if (!profile) return null;

    return {
      ...profile,
      user: {
        ...profile.user,
        name: profile.name,
      }
    };
  }

  static async findById(id: string) {
    return db.teacherProfile.findUnique({
      where: { userId: id },
    });
  }

  static async listTeachersForAdmin(status?: VerificationStatus) {
    const teachers = await db.teacherProfile.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, email: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    const mappedTeachers = teachers.map(t => ({
      ...t,
      user: {
        ...t.user,
        name: t.name
      }
    }));

    const counts = await db.teacherProfile.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const summary: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, INTERVIEW_SCHEDULED: 0, total: 0 };
    for (const c of counts) {
      summary[c.status] = c._count._all;
      summary.total += c._count._all;
    }

    return { teachers: mappedTeachers, summary };
  }

  static async updateVerificationStatus(id: string, status: VerificationStatus) {
    const profile = await db.teacherProfile.update({
      where: { userId: id },
      data: { status },
      include: { user: { select: { id: true, email: true, createdAt: true } } },
    });

    return {
      ...profile,
      user: {
        ...profile.user,
        name: profile.name
      }
    };
  }
}
export default TeacherService;

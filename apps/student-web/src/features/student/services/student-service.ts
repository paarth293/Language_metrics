import { db } from "@/lib/db";

export class StudentService {
  static async getProfile(userId: string) {
    const profile = await db.studentProfile.findUnique({
      where: { userId },
      include: { user: { select: { id: true, email: true, createdAt: true } } },
    });

    if (!profile) return null;

    // Maintain backwards compatibility with code expecting { user: { name } }
    return {
      ...profile,
      user: {
        ...profile.user,
        name: profile.name,
      }
    };
  }
}
export default StudentService;

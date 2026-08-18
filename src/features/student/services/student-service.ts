import { db } from "@/lib/db";

export class StudentService {
  static async getProfile(userId: string) {
    return db.student.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }
}
export default StudentService;

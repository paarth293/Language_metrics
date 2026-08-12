import { db } from "@/lib/db";

export class AdminService {
  static async getProfile(userId: string) {
    return db.admin.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });
  }
}
export default AdminService;

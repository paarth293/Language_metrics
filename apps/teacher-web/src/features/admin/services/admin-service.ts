import { db } from "@/lib/db";

export class AdminService {
  static async getProfile(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId, role: "ADMIN" },
    });
    
    if (!user) return null;
    
    // Maintain backwards compatibility by returning it with a nested user object 
    // or just returning the user itself with name defaulting to "Admin"
    return {
      userId: user.id,
      user: {
        id: user.id,
        name: "Admin", // Admin profile has no name in schema, defaulting to Admin
        email: user.email,
        createdAt: user.createdAt,
      }
    };
  }
}
export default AdminService;

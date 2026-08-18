import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import { loginSchema, registerStudentSchema, registerTeacherSchema } from "@/features/auth/validators/auth";
import type { User } from "@/types";
import type { z } from "zod";

type LoginInput = z.infer<typeof loginSchema>;
type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export class AuthService {
  static async login(data: LoginInput): Promise<{ token: string; user: User } | null> {
    const user = await db.user.findUnique({ where: { email: data.email } });
    if (!user) return null;

    const isMatch = await bcrypt.compare(data.password, user.passwordHash);
    if (!isMatch) return null;

    const token = signToken(user.id, user.role);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  static async registerStudent(data: RegisterStudentInput): Promise<{ token: string; user: User } | null> {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return null;

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: "STUDENT",
        student: {
          create: {
            languageToLearn: data.languageToLearn,
            proficiencyLevel: data.proficiencyLevel || "beginner",
          },
        },
      },
    });

    const token = signToken(user.id, user.role);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  static async registerTeacher(data: RegisterTeacherInput): Promise<{ token: string; user: User } | null> {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return null;

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await db.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: "TEACHER",
        teacher: {
          create: {
            experienceType: data.experienceType,
            status: "pending",
          },
        },
      },
    });

    const token = signToken(user.id, user.role);
    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }
}
export default AuthService;

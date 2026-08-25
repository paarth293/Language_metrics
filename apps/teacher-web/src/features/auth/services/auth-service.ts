import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { loginSchema, registerStudentSchema, registerTeacherSchema } from "@/features/auth/validators/auth";
import type { User } from "@/types";
import type { z } from "zod";

type LoginInput = z.infer<typeof loginSchema>;
type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export class AuthService {
  static async login(data: LoginInput): Promise<{ token: string; user: User } | null> {
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { studentProfile: true, teacherProfile: true },
    });
    if (!user || !user.passwordHash) return null;
    
    // Strict role check: if the login form specified a role, it MUST match the user's role.
    if (data.role && user.role !== data.role) return null;

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) return null;

    const token = signToken(user.id, user.role);
    const name = user.studentProfile?.name || user.teacherProfile?.name || "User";
    
    return {
      token,
      user: {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
      },
    };
  }

  static async registerStudent(data: RegisterStudentInput): Promise<{ token: string; user: User } | null> {
    const existing = await db.user.findUnique({ 
      where: { email: data.email },
      include: { studentProfile: true }
    });

    const passwordHash = await bcrypt.hash(data.password, 10);

    if (existing) {
      // If they already have a password, they should login
      if (existing.passwordHash) return null;
      // If role mismatches, block linking
      if (existing.role !== "STUDENT") return null;

      // Link OAuth account with password credentials
      const user = await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          ...(existing.studentProfile?.onboardingComplete ? {} : {
            studentProfile: {
              update: {
                name: data.name,
                languageToLearn: data.languageToLearn,
                proficiencyLevel: data.proficiencyLevel === "advanced" ? "ADVANCED" : data.proficiencyLevel === "intermediate" ? "INTERMEDIATE" : "BEGINNER",
                onboardingComplete: true,
              }
            }
          })
        },
        include: { studentProfile: true },
      });

      return {
        token: signToken(user.id, user.role),
        user: { id: user.id, name: user.studentProfile!.name, email: user.email, role: user.role },
      };
    }

    const userId = crypto.randomUUID();
    const user = await db.user.create({
      data: {
        id: userId,
        email: data.email,
        passwordHash,
        role: "STUDENT",
        studentProfile: {
          create: {
            name: data.name,
            languageToLearn: data.languageToLearn,
            proficiencyLevel: data.proficiencyLevel === "advanced" ? "ADVANCED" : data.proficiencyLevel === "intermediate" ? "INTERMEDIATE" : "BEGINNER",
            onboardingComplete: true,
          },
        },
      },
      include: { studentProfile: true },
    });

    return {
      token: signToken(user.id, user.role),
      user: { id: user.id, name: user.studentProfile!.name, email: user.email, role: user.role },
    };
  }

  static async registerTeacher(data: RegisterTeacherInput): Promise<{ token: string; user: User } | null> {
    const existing = await db.user.findUnique({ 
      where: { email: data.email },
      include: { teacherProfile: true }
    });

    const passwordHash = await bcrypt.hash(data.password, 10);

    if (existing) {
      if (existing.passwordHash) return null;
      if (existing.role !== "TEACHER") return null;

      const user = await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          ...(existing.teacherProfile?.onboardingComplete ? {} : {
            teacherProfile: {
              update: {
                name: data.name,
                experienceLevel: data.experienceType === "experienced" ? "EXPERIENCED" : "FRESHER",
                status: "PENDING",
                language: data.language,
                gender: data.gender,
                onboardingComplete: true,
              }
            }
          })
        },
        include: { teacherProfile: true },
      });

      return {
        token: signToken(user.id, user.role),
        user: { id: user.id, name: user.teacherProfile!.name, email: user.email, role: user.role },
      };
    }

    const userId = crypto.randomUUID();
    const user = await db.user.create({
      data: {
        id: userId,
        email: data.email,
        passwordHash,
        role: "TEACHER",
        teacherProfile: {
          create: {
            name: data.name,
            experienceLevel: data.experienceType === "experienced" ? "EXPERIENCED" : "FRESHER",
            status: "PENDING",
            language: data.language,
            gender: data.gender,
            onboardingComplete: true,
          },
        },
      },
      include: { teacherProfile: true },
    });

    return {
      token: signToken(user.id, user.role),
      user: { id: user.id, name: user.teacherProfile!.name, email: user.email, role: user.role },
    };
  }
}
export default AuthService;

import { db } from "@/lib/db";
import { signToken } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { loginSchema, registerStudentSchema, registerTeacherSchema } from "@/features/auth/validators/auth";
import type { User } from "@/types";
import type { z } from "zod";
import { generateEmailOTP, hashOTP } from "@/lib/otp";
import { sendVerificationOTP } from "@/lib/email";

type LoginInput = z.infer<typeof loginSchema>;
type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export class AuthService {
  static async login(data: LoginInput): Promise<{ token: string; user: User } | { error: string } | null> {
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { studentProfile: true, teacherProfile: true },
    });
    if (!user || !user.passwordHash) return null;
    
    // Strict role check: if the login form specified a role, it MUST match the user's role.
    if (data.role && user.role !== data.role) return null;

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) return null;

    if (!user.emailVerified) {
      return { error: "UNVERIFIED_EMAIL" };
    }

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

  static async registerStudent(data: RegisterStudentInput): Promise<{ success: boolean; verificationRequired: boolean; message: string } | null> {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return null;

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(data.password, 10);
    const otp = generateEmailOTP();
    const codeHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

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
          },
        },
        verificationCodes: {
          create: {
            codeHash,
            expiresAt,
          },
        },
      },
      include: { studentProfile: true },
    });

    await sendVerificationOTP(user.email, otp);

    return {
      success: true,
      verificationRequired: true,
      message: "Please verify your email.",
    };
  }

  static async registerTeacher(data: RegisterTeacherInput): Promise<{ success: boolean; verificationRequired: boolean; message: string } | null> {
    const existing = await db.user.findUnique({ where: { email: data.email } });
    if (existing) return null;

    const userId = crypto.randomUUID();
    const passwordHash = await bcrypt.hash(data.password, 10);
    const otp = generateEmailOTP();
    const codeHash = hashOTP(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

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
          },
        },
        verificationCodes: {
          create: {
            codeHash,
            expiresAt,
          },
        },
      },
      include: { teacherProfile: true },
    });

    await sendVerificationOTP(user.email, otp);

    return {
      success: true,
      verificationRequired: true,
      message: "Please verify your email.",
    };
  }
}
export default AuthService;

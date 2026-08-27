import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { loginSchema, registerStudentSchema, registerTeacherSchema } from "@/features/auth/validators/auth";
import type { User } from "@/types";
import type { z } from "zod";
import { generateOtp, hashOtp } from "@/lib/otp";
import { sendVerificationOTP } from "@/lib/email";

type LoginInput = z.infer<typeof loginSchema>;
type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;

export class AuthService {
  static async login(
    data: LoginInput
  ): Promise<{ user: User } | { error: "USER_NOT_FOUND" | "INVALID_CREDENTIALS" | "UNVERIFIED_EMAIL" }> {
    const user = await db.user.findUnique({
      where: { email: data.email },
      include: { studentProfile: true, teacherProfile: true },
    });
    if (!user) return { error: "USER_NOT_FOUND" };
    if (!user.passwordHash) return { error: "INVALID_CREDENTIALS" };

    // Strict role check: if the login form specified a role, it MUST match the user's role.
    if (data.role && user.role !== data.role) return { error: "INVALID_CREDENTIALS" };

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) return { error: "INVALID_CREDENTIALS" };

    // Email verification enforcement — unverified users cannot receive tokens
    console.log("LOGIN CHECK for", user.email, "-> emailVerified is:", user.emailVerified);
    if (!user.emailVerified) {
      return { error: "UNVERIFIED_EMAIL" };
    }

    const name = user.studentProfile?.name ?? user.teacherProfile?.name ?? "User";
    return {
      user: {
        id: user.id,
        name,
        email: user.email,
        role: user.role,
      },
    };
  }

  static async registerStudent(data: RegisterStudentInput, emailVerified: boolean = false): Promise<{ user: User } | null> {
    const existing = await db.user.findUnique({
      where: { email: data.email },
      include: { studentProfile: true }
    });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

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
        emailVerified,
        studentProfile: {
          create: {
            name: data.name,
            languageToLearn: data.languageToLearn,
            proficiencyLevel: data.proficiencyLevel === "advanced" ? "ADVANCED" : data.proficiencyLevel === "intermediate" ? "INTERMEDIATE" : "BEGINNER",
            onboardingComplete: true,
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

    if (!emailVerified) {
      await sendVerificationOTP(user.email, otp);
    }

    return {
      user: { id: user.id, name: user.studentProfile!.name, email: user.email, role: user.role },
    };
  }

  static async registerTeacher(data: RegisterTeacherInput, emailVerified: boolean = false): Promise<{ user: User } | null> {
    const existing = await db.user.findUnique({
      where: { email: data.email },
      include: { teacherProfile: true }
    });

    const passwordHash = await bcrypt.hash(data.password, 10);
    const otp = generateOtp();
    const codeHash = await hashOtp(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    // Build document records for the teacher
    const documentsToCreate = [
      {
        type: "EDUCATION" as const,
        url: data.qualificationDocUrl,
        status: "PENDING" as const,
      },
      {
        type: "ID_PROOF" as const,
        url: data.idProofDocUrl,
        status: "PENDING" as const,
      },
      // Only include experience document if provided
      ...(data.experienceDocUrl
        ? [
            {
              type: "EXPERIENCE_LETTER" as const,
              url: data.experienceDocUrl,
              status: "PENDING" as const,
            },
          ]
        : []),
    ];

    if (existing) {
      if (existing.passwordHash) return null;
      if (existing.role !== "TEACHER") return null;

      const user = await db.user.update({
        where: { id: existing.id },
        data: {
          passwordHash,
          emailVerified,
          ...(existing.teacherProfile?.onboardingComplete ? {} : {
            teacherProfile: {
              update: {
                name: data.name,
                experienceLevel: data.experienceType === "experienced" ? "EXPERIENCED" : "FRESHER",
                status: "PENDING",
                language: data.language,
                languages: data.languages,
                gender: data.gender,
                bio: data.experienceDescription?.trim() || null,
                onboardingComplete: true,
              },
            }
          })
        },
        include: { teacherProfile: true },
      });

      // Create document records for the teacher
      if (user.teacherProfile) {
        await db.teacherDocument.createMany({
          data: documentsToCreate.map((doc) => ({
            ...doc,
            teacherId: user.teacherProfile!.userId,
          })),
        });
      }

      return {
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
        emailVerified,
        teacherProfile: {
          create: {
            name: data.name,
            experienceLevel: data.experienceType === "experienced" ? "EXPERIENCED" : "FRESHER",
            status: "PENDING",
            language: data.language,
            languages: data.languages,
            gender: data.gender,
            bio: data.experienceDescription?.trim() || null,
            onboardingComplete: true,
            documents: {
              create: documentsToCreate,
            },
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
    if (!emailVerified) {
      await sendVerificationOTP(user.email, otp);
    }

    return {
      user: { id: user.id, name: user.teacherProfile!.name, email: user.email, role: user.role },
    };
  }
}
export default AuthService;

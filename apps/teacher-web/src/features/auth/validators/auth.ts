import { z } from "zod";

// ─── Exported password rule constants ────────────────────────────────────────
// Single source of truth: both this schema and the UI strength meter import
// these so they can never silently drift out of sync.
export const PASSWORD_RULES = {
  minLength: 8,
  maxLength: 100,
  uppercase: /[A-Z]/,
  lowercase: /[a-z]/,
  digit: /[0-9]/,
} as const;

// ─── Shared sub-schemas ───────────────────────────────────────────────────────

// Name: trimmed, length-bounded, and restricted to safe Unicode letter/space
// characters. This blocks payloads like '<script>alert(1)</script>' and emoji
// spam before they ever reach the database or a render surface.
const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters.")
  .max(50, "Name cannot exceed 50 characters.")
  .regex(
    /^[\p{L}\p{M}'\-\s]+$/u,
    "Name may only contain letters, spaces, hyphens, and apostrophes."
  );

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email("Please enter a valid email address.");

// passwordSchema is NOT exported directly — importers use PASSWORD_RULES for
// the raw rules and rely on the schema objects for Zod validation.
const passwordSchema = z
  .string({ message: "Password is required." })
  .min(PASSWORD_RULES.minLength, "Password must be at least 8 characters.")
  .max(PASSWORD_RULES.maxLength, "Password is too long.")
  .regex(PASSWORD_RULES.uppercase, "Password must contain at least one uppercase letter.")
  .regex(PASSWORD_RULES.lowercase, "Password must contain at least one lowercase letter.")
  .regex(PASSWORD_RULES.digit, "Password must contain at least one number.");

// ─── loginSchema ─────────────────────────────────────────────────────────────
// .strict() strips NO unknown fields and rejects any unrecognised key.
// For the login form this is safe because the payload should ONLY ever be
// {email, password}. An attacker sending `{email, password, role:"admin"}`
// will receive a 400 before the route logic runs.
export const loginSchema = z
  .object({
    email: emailSchema,
    // Login password is intentionally NOT run through the full passwordSchema
    // strength checks — users with old weak passwords must still be able to
    // log in and reset. Only presence is required.
    password: z
      .string({ message: "Password is required." })
      .min(1, "Password is required."),
    role: z.enum(["STUDENT", "TEACHER", "ADMIN"]).optional(),
  })
  .strict();

// ─── Date of birth ────────────────────────────────────────────────────────────
/**
 * Minimum age at signup. Teachers must be adults; the student floor of 5 is a
 * product assumption (young learners sign up with a parent) — revisit it with
 * the parental-consent requirements for under-18s.
 */
export const MIN_AGE = { STUDENT: 5, TEACHER: 18 } as const;

/** Parses "YYYY-MM-DD" (what <input type="date"> produces) as a UTC calendar date. */
export function parseDateOfBirth(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  // Rejects impossible dates such as 2010-02-31, which Date would roll over.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

/** Whole years between `dob` and `today`, compared as UTC calendar dates. */
export function ageInYears(dob: Date, today: Date = new Date()): number {
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Latest allowed birth date ("YYYY-MM-DD") for someone at least `minAge` today — for <input max>. */
export function latestBirthDate(minAge: number, today: Date = new Date()): string {
  const d = new Date(today);
  d.setFullYear(d.getFullYear() - minAge);
  return d.toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" date of birth, at least `minAge` years ago and not absurdly old. */
export function dateOfBirthSchema(minAge: number) {
  return z
    .string({ message: "Please enter your date of birth." })
    .superRefine((value, ctx) => {
      const dob = parseDateOfBirth(value);
      if (!dob) {
        ctx.addIssue({ code: "custom", message: "Please enter a valid date of birth." });
        return;
      }
      const age = ageInYears(dob);
      if (dob.getTime() > Date.now()) {
        ctx.addIssue({ code: "custom", message: "Date of birth can't be in the future." });
      } else if (age < minAge) {
        ctx.addIssue({ code: "custom", message: `You must be at least ${minAge} years old to sign up.` });
      } else if (age > 120) {
        ctx.addIssue({ code: "custom", message: "Please enter a valid date of birth." });
      }
    });
}

// ─── Step schemas for teacher multi-step form ─────────────────────────────────
// Defined as standalone objects so .pick() is never needed.
// .pick() breaks if the parent schema is ever wrapped in .refine()/.superRefine()
// (those produce ZodEffects, which has no .pick() method).
export const teacherStep1Schema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
  })
  .strict();

export const teacherStep2Schema = z
  .object({
    language: z.string().min(1, "Please select a primary language."),
    languages: z.array(z.string()).min(1, "Please select at least one language."),
    gender: z.enum(["male", "female", "other"]).optional(),
    dateOfBirth: dateOfBirthSchema(MIN_AGE.TEACHER),
  })
  .strict();

export const teacherStep3Schema = z
  .object({
    qualificationDocUrl: z
      .string()
      .min(1, "Please upload your qualification certificate."),
    idProofDocUrl: z
      .string()
      .min(1, "Please upload your ID proof."),
  })
  .strict();

export const teacherStep4Schema = z
  .object({
    experienceType: z.enum(["fresher", "experienced"], {
      message: "Please select a valid experience type.",
    }),
    experienceDocUrl: z.string().optional(),
    experienceDescription: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.experienceType === "experienced" && (!data.experienceDocUrl || data.experienceDocUrl.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload your experience document.",
        path: ["experienceDocUrl"],
      });
    }
  });

// ─── registerStudentSchema ────────────────────────────────────────────────────
export const registerStudentSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    languageToLearn: z
      .string()
      .trim()
      .min(2, "Please specify a valid language.")
      .max(30, "Language name is too long."),
    proficiencyLevel: z
      .string()
      .min(1, "Please select a proficiency level.")
      .max(50, "Level name is too long.")
      .optional()
      .default("A1"),
    dateOfBirth: dateOfBirthSchema(MIN_AGE.STUDENT),
  })
  .strict();

// ─── registerTeacherSchema ────────────────────────────────────────────────────
export const registerTeacherSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    language: z.string().min(1, "Please select a primary language."),
    languages: z.array(z.string()).min(1, "Please select at least one language."),
    gender: z.enum(["male", "female", "other"]).optional(),
    dateOfBirth: dateOfBirthSchema(MIN_AGE.TEACHER),
    qualificationDocUrl: z
      .string()
      .min(1, "Please upload your qualification certificate."),
    idProofDocUrl: z
      .string()
      .min(1, "Please upload your ID proof."),
    experienceType: z.enum(["fresher", "experienced"], {
      message: "Please select a valid experience type.",
    }),
    experienceDocUrl: z.string().optional(),
    experienceDescription: z.string().max(500).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.experienceType === "experienced" && (!data.experienceDocUrl || data.experienceDocUrl.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Please upload your experience document.",
        path: ["experienceDocUrl"],
      });
    }
  });

// ─── resetPasswordSchema ──────────────────────────────────────────────────────
export const resetPasswordSchema = z
  .object({
    resetSessionToken: z.string().min(1, "Reset session token is required."),
    newPassword: passwordSchema,
    confirmPassword: z.string({ message: "Please confirm your password." }),
  })
  .strict()
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

// ─── Inferred types ───────────────────────────────────────────────────────────
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterStudentInput = z.infer<typeof registerStudentSchema>;
export type RegisterTeacherInput = z.infer<typeof registerTeacherSchema>;
export type TeacherStep1Input = z.infer<typeof teacherStep1Schema>;
export type TeacherStep2Input = z.infer<typeof teacherStep2Schema>;
export type TeacherStep3Input = z.infer<typeof teacherStep3Schema>;
export type TeacherStep4Input = z.infer<typeof teacherStep4Schema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

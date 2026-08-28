import { describe, it, expect } from "vitest";
import {
  loginSchema,
  registerStudentSchema,
  registerTeacherSchema,
  resetPasswordSchema,
  teacherStep1Schema,
  teacherStep2Schema,
  teacherStep3Schema,
  PASSWORD_RULES,
} from "./auth";

describe("loginSchema", () => {
  it("should accept valid login input", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret123",
    });
    expect(result.success).toBe(true);
  });

  it("should accept login with optional role", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "P@ss1234",
      role: "STUDENT",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing email", () => {
    const result = loginSchema.safeParse({ password: "secret" });
    expect(result.success).toBe(false);
  });

  it("should reject missing password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(false);
  });

  it("should reject empty password", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email format", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "secret",
    });
    expect(result.success).toBe(false);
  });

  it("should reject extra/unknown fields (strict mode)", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret",
      isAdmin: true,
    });
    expect(result.success).toBe(false);
  });

  it("should normalize email to lowercase", () => {
    const result = loginSchema.safeParse({
      email: "User@EXAMPLE.com",
      password: "secret",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("should reject invalid role values", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "secret",
      role: "SUPERADMIN",
    });
    expect(result.success).toBe(false);
  });
});

describe("registerStudentSchema", () => {
  const validStudent = {
    name: "John Doe",
    email: "john@example.com",
    password: "SecurePass1",
    languageToLearn: "Spanish",
  };

  it("should accept valid student registration", () => {
    const result = registerStudentSchema.safeParse(validStudent);
    expect(result.success).toBe(true);
  });

  it("should accept with optional proficiencyLevel", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      proficiencyLevel: "intermediate",
    });
    expect(result.success).toBe(true);
  });

  it("should default proficiencyLevel to beginner", () => {
    const result = registerStudentSchema.safeParse(validStudent);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proficiencyLevel).toBe("beginner");
    }
  });

  it("should reject XSS in name field", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      name: '<script>alert("xss")</script>',
    });
    expect(result.success).toBe(false);
  });

  it("should reject emoji in name field", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      name: "John 🔥 Doe",
    });
    expect(result.success).toBe(false);
  });

  it("should accept names with apostrophes and hyphens", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      name: "O'Brien-Smith",
    });
    expect(result.success).toBe(true);
  });

  it("should accept names with Unicode letters", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      name: "María García",
    });
    expect(result.success).toBe(true);
  });

  it("should reject names that are too short", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      name: "A",
    });
    expect(result.success).toBe(false);
  });

  it("should reject names that are too long", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      name: "A".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("should reject extra/unknown fields", () => {
    const result = registerStudentSchema.safeParse({
      ...validStudent,
      isAdmin: true,
    });
    expect(result.success).toBe(false);
  });
});

describe("registerTeacherSchema", () => {
  const validTeacher = {
    name: "Jane Smith",
    email: "jane@example.com",
    password: "StrongPass1",
    language: "French",
    experienceType: "experienced" as const,
  };

  it("should accept valid teacher registration", () => {
    const result = registerTeacherSchema.safeParse(validTeacher);
    expect(result.success).toBe(true);
  });

  it("should accept with optional gender", () => {
    const result = registerTeacherSchema.safeParse({
      ...validTeacher,
      gender: "female",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid experienceType", () => {
    const result = registerTeacherSchema.safeParse({
      ...validTeacher,
      experienceType: "expert",
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing language", () => {
    const { language, ...withoutLanguage } = validTeacher;
    const result = registerTeacherSchema.safeParse(withoutLanguage);
    expect(result.success).toBe(false);
  });

  it("should reject invalid gender values", () => {
    const result = registerTeacherSchema.safeParse({
      ...validTeacher,
      gender: "invalid",
    });
    expect(result.success).toBe(false);
  });
});

describe("Password strength validation", () => {
  const baseInput = {
    name: "Test User",
    email: "test@example.com",
    languageToLearn: "English",
  };

  it("should reject passwords shorter than minimum length", () => {
    const result = registerStudentSchema.safeParse({
      ...baseInput,
      password: "Aa1" + "x".repeat(PASSWORD_RULES.minLength - 4),
    });
    expect(result.success).toBe(false);
  });

  it("should accept passwords at minimum length with all requirements", () => {
    // minLength is 8: "Abcdef1x" = 8 chars with uppercase, lowercase, digit
    const result = registerStudentSchema.safeParse({
      ...baseInput,
      password: "Abcdef1x",
    });
    expect(result.success).toBe(true);
  });

  it("should reject passwords missing uppercase", () => {
    const result = registerStudentSchema.safeParse({
      ...baseInput,
      password: "alllowercase1",
    });
    expect(result.success).toBe(false);
  });

  it("should reject passwords missing lowercase", () => {
    const result = registerStudentSchema.safeParse({
      ...baseInput,
      password: "ALLUPPERCASE1",
    });
    expect(result.success).toBe(false);
  });

  it("should reject passwords missing a digit", () => {
    const result = registerStudentSchema.safeParse({
      ...baseInput,
      password: "NoDigitsHere",
    });
    expect(result.success).toBe(false);
  });

  it("should reject passwords exceeding max length", () => {
    const result = registerStudentSchema.safeParse({
      ...baseInput,
      password: "A1" + "a".repeat(PASSWORD_RULES.maxLength),
    });
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  const validReset = {
    resetSessionToken: "jwt-token-here",
    newPassword: "NewPassword1",
    confirmPassword: "NewPassword1",
  };

  it("should accept valid reset input", () => {
    const result = resetPasswordSchema.safeParse(validReset);
    expect(result.success).toBe(true);
  });

  it("should reject when passwords don't match", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      confirmPassword: "DifferentPassword1",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const mismatch = result.error.issues.find(
        (i) => i.path.includes("confirmPassword")
      );
      expect(mismatch).toBeDefined();
    }
  });

  it("should reject missing reset session token", () => {
    const result = resetPasswordSchema.safeParse({
      newPassword: "NewPassword1",
      confirmPassword: "NewPassword1",
    });
    expect(result.success).toBe(false);
  });

  it("should enforce password strength on newPassword", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      newPassword: "weak",
      confirmPassword: "weak",
    });
    expect(result.success).toBe(false);
  });

  it("should reject extra fields", () => {
    const result = resetPasswordSchema.safeParse({
      ...validReset,
      extraField: "malicious",
    });
    expect(result.success).toBe(false);
  });
});

describe("teacherStep1Schema", () => {
  it("should accept valid step 1 input", () => {
    const result = teacherStep1Schema.safeParse({
      name: "Jane Smith",
      email: "jane@example.com",
      password: "StrongPass1",
    });
    expect(result.success).toBe(true);
  });

  it("should reject extra fields", () => {
    const result = teacherStep1Schema.safeParse({
      name: "Jane Smith",
      email: "jane@example.com",
      password: "StrongPass1",
      language: "French",
    });
    expect(result.success).toBe(false);
  });
});

describe("teacherStep2Schema", () => {
  it("should accept valid step 2 input", () => {
    const result = teacherStep2Schema.safeParse({
      language: "French",
    });
    expect(result.success).toBe(true);
  });

  it("should accept optional gender", () => {
    const result = teacherStep2Schema.safeParse({
      language: "French",
      gender: "male",
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty language", () => {
    const result = teacherStep2Schema.safeParse({
      language: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("teacherStep3Schema", () => {
  it("should accept valid step 3 input", () => {
    const result = teacherStep3Schema.safeParse({
      experienceType: "fresher",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid experience type", () => {
    const result = teacherStep3Schema.safeParse({
      experienceType: "senior",
    });
    expect(result.success).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AuthService } from "./auth-service";
import { db } from "@/lib/db";
import { POST as sendOtpHandler } from "@/app/api/auth/send-registration-otp/route";
import { POST as registerStudentHandler } from "@/app/api/auth/register/student/route";
import { POST as registerTeacherHandler } from "@/app/api/auth/register/teacher/route";
import { GET as checkEmailHandler } from "@/app/api/auth/check-email/route";
import { NextRequest } from "next/server";

// Mock dependencies
vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    adminUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    teacherDocument: {
      createMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn().mockResolvedValue(true),
  sendVerificationOTP: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/lib/redis-client", () => ({
  getRedisClient: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/memory-otp-store", () => ({
  memoryOtpStore: {
    setHash: vi.fn(),
    isVerified: vi.fn().mockReturnValue(true),
  },
}));

vi.mock("@/lib/tokens", () => ({
  signAccessToken: vi.fn().mockResolvedValue("mock-access-token"),
  signRefreshToken: vi.fn().mockResolvedValue("mock-refresh-token"),
  accessCookieOptions: {},
  refreshCookieOptions: {},
}));

vi.mock("@/lib/redis-session", () => ({
  storeRefreshSession: vi.fn().mockResolvedValue(undefined),
}));

describe("Duplicate Email Validation & Concurrency Safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const validStudentInput = {
    name: "Alex Doe",
    email: "student@example.com",
    password: "Password123!",
    dateOfBirth: "2000-01-01",
    languageToLearn: "Spanish",
    proficiencyLevel: "A1",
  };

  const validTeacherInput = {
    name: "Professor Smith",
    email: "teacher@example.com",
    password: "Password123!",
    language: "Spanish",
    languages: ["Spanish", "English"],
    dateOfBirth: "1990-01-01",
    qualificationDocUrl: "https://example.com/qual.pdf",
    idProofDocUrl: "https://example.com/id.pdf",
    experienceType: "fresher" as const,
  };

  describe("AuthService.registerStudent", () => {
    it("1. succeeds when registering with a new email", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.user.create).mockResolvedValueOnce({
        id: "new-user-id",
        email: "student@example.com",
        role: "STUDENT",
        studentProfile: { name: "Alex Doe" },
      } as never);

      const result = await AuthService.registerStudent(validStudentInput, true);
      expect(result).not.toBeNull();
      expect(result?.user.email).toBe("student@example.com");
      expect(db.user.create).toHaveBeenCalledTimes(1);
    });

    it("2. returns null when registering with an already registered email having password", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "existing-id",
        email: "student@example.com",
        role: "STUDENT",
        passwordHash: "existing-hash",
      } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const result = await AuthService.registerStudent(validStudentInput, true);
      expect(result).toBeNull();
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("3. normalizes email case and whitespace before checking existence and creating", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.user.create).mockResolvedValueOnce({
        id: "new-user-id",
        email: "student@example.com",
        role: "STUDENT",
        studentProfile: { name: "Alex Doe" },
      } as never);

      const inputWithSpacesAndCaps = {
        ...validStudentInput,
        email: "   STUDENT@EXAMPLE.COM   ",
      };

      const result = await AuthService.registerStudent(inputWithSpacesAndCaps, true);
      expect(result).not.toBeNull();
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: "student@example.com" },
        include: { studentProfile: true },
      });
      expect(db.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            email: "student@example.com",
          }),
        })
      );
    });

    it("4. handles simultaneous registration attempts safely when DB throws P2002", async () => {
      // Both concurrent requests saw null in findUnique
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      // But db.user.create throws Prisma unique constraint violation code P2002
      const p2002Error = new Error("Unique constraint failed on the fields: (`email`)");
      (p2002Error as unknown as { code: string }).code = "P2002";
      vi.mocked(db.user.create).mockRejectedValueOnce(p2002Error);

      const result = await AuthService.registerStudent(validStudentInput, true);
      // Must not throw an unhandled exception or leak DB internals; returns null
      expect(result).toBeNull();
    });

    it("5. blocks student registration if email belongs to an AdminUser", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce({ userId: "admin-id" } as never);

      const result = await AuthService.registerStudent(validStudentInput, true);
      expect(result).toBeNull();
      expect(db.user.create).not.toHaveBeenCalled();
    });
  });

  describe("AuthService.registerTeacher", () => {
    it("1. succeeds when registering a teacher with a new email", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.user.create).mockResolvedValueOnce({
        id: "teacher-id",
        email: "teacher@example.com",
        role: "TEACHER",
        teacherProfile: { name: "Professor Smith" },
      } as never);

      const result = await AuthService.registerTeacher(validTeacherInput, true);
      expect(result).not.toBeNull();
      expect(result?.user.email).toBe("teacher@example.com");
      expect(db.user.create).toHaveBeenCalledTimes(1);
    });

    it("2. returns null when teacher email is already registered", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "existing-id",
        email: "teacher@example.com",
        role: "TEACHER",
        passwordHash: "existing-hash",
      } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const result = await AuthService.registerTeacher(validTeacherInput, true);
      expect(result).toBeNull();
      expect(db.user.create).not.toHaveBeenCalled();
    });

    it("3. handles concurrent race condition via P2002 safely in registerTeacher", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const p2002Error = new Error("Unique constraint failed on the fields: (`email`)");
      (p2002Error as unknown as { code: string }).code = "P2002";
      vi.mocked(db.user.create).mockRejectedValueOnce(p2002Error);

      const result = await AuthService.registerTeacher(validTeacherInput, true);
      expect(result).toBeNull();
    });
  });

  describe("POST /api/auth/send-registration-otp", () => {
    it("returns 409 EMAIL_ALREADY_EXISTS with user-friendly message when email is already registered", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "user-123" } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/send-registration-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "already.registered@example.com" }),
      });

      const res = await sendOtpHandler(req);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(body.message).toBe(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      );
    });

    it("normalizes email case and whitespace before checking in send-registration-otp", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "user-123" } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/send-registration-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "   ALREADY.REGISTERED@EXAMPLE.COM   " }),
      });

      const res = await sendOtpHandler(req);
      expect(res.status).toBe(409);
      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: "already.registered@example.com" },
        select: { id: true },
      });
    });

    it("returns 200 verification code sent when email is new", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/send-registration-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "brand.new.user@example.com" }),
      });

      const res = await sendOtpHandler(req);
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.message).toBe("Verification code sent.");
    });
  });

  describe("POST /api/auth/register/student route", () => {
    it("returns 409 EMAIL_ALREADY_EXISTS with user-friendly message when account already exists", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "existing-id",
        email: "student@example.com",
        role: "STUDENT",
        passwordHash: "hash",
      } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/register/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validStudentInput),
      });

      const res = await registerStudentHandler(req);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(body.message).toBe(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      );
    });

    it("handles concurrency P2002 race condition by returning safe 409 EMAIL_ALREADY_EXISTS response", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const p2002Error = new Error("Unique constraint failed on the fields: (`email`)");
      (p2002Error as unknown as { code: string }).code = "P2002";
      vi.mocked(db.user.create).mockRejectedValueOnce(p2002Error);

      const req = new NextRequest("http://localhost/api/auth/register/student", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validStudentInput),
      });

      const res = await registerStudentHandler(req);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(body.message).toBe(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      );
    });
  });

  describe("POST /api/auth/register/teacher route", () => {
    it("returns 409 EMAIL_ALREADY_EXISTS with user-friendly message when teacher account already exists", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: "existing-id",
        email: "teacher@example.com",
        role: "TEACHER",
        passwordHash: "hash",
      } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/register/teacher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(validTeacherInput),
      });

      const res = await registerTeacherHandler(req);
      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(body.message).toBe(
        "This email address is already registered. Please use another email address or sign in to your existing account."
      );
    });
  });

  describe("GET /api/auth/check-email route", () => {
    it("returns 400 when email parameter is missing", async () => {
      const req = new NextRequest("http://localhost/api/auth/check-email", {
        method: "GET",
      });

      const res = await checkEmailHandler(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.available).toBe(false);
      expect(body.message).toBe("Email is required.");
    });

    it("returns 400 when email parameter is invalid format", async () => {
      const req = new NextRequest("http://localhost/api/auth/check-email?email=invalid-email", {
        method: "GET",
      });

      const res = await checkEmailHandler(req);
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.available).toBe(false);
      expect(body.message).toBe("Please enter a valid email address.");
    });

    it("normalizes email (whitespace and lowercase) and checks both db.user and db.adminUser", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/check-email?email=%20%20Student%40Example.COM%20%20", {
        method: "GET",
      });

      const res = await checkEmailHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.available).toBe(true);

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { email: "student@example.com" },
        select: { id: true },
      });
      expect(db.adminUser.findUnique).toHaveBeenCalledWith({
        where: { email: "student@example.com" },
        select: { userId: true },
      });
    });

    it("returns available: false with EMAIL_ALREADY_EXISTS when user exists in db.user", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({ id: "user-123" } as never);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce(null);

      const req = new NextRequest("http://localhost/api/auth/check-email?email=existing@example.com", {
        method: "GET",
      });

      const res = await checkEmailHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.available).toBe(false);
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(body.message).toBe(
        "This email is already registered. Please use another email address or sign in to your existing account."
      );
    });

    it("returns available: false with EMAIL_ALREADY_EXISTS when user exists in db.adminUser", async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce(null);
      vi.mocked(db.adminUser.findUnique).mockResolvedValueOnce({ userId: "admin-456" } as never);

      const req = new NextRequest("http://localhost/api/auth/check-email?email=admin@example.com", {
        method: "GET",
      });

      const res = await checkEmailHandler(req);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.available).toBe(false);
      expect(body.code).toBe("EMAIL_ALREADY_EXISTS");
      expect(body.message).toBe(
        "This email is already registered. Please use another email address or sign in to your existing account."
      );
    });

    it("returns 500 when database throws an unexpected error", async () => {
      vi.mocked(db.user.findUnique).mockRejectedValueOnce(new Error("Database connection lost"));

      const req = new NextRequest("http://localhost/api/auth/check-email?email=check@example.com", {
        method: "GET",
      });

      const res = await checkEmailHandler(req);
      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.message).toBe("An unexpected error occurred. Please try again.");
    });
  });
});

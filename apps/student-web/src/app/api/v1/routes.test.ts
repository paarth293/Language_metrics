import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getClassesHandler } from "./classes/route";
import { POST as createBookingHandler } from "./bookings/route";
import { POST as getLiveKitTokenHandler } from "./classes/[id]/token/route";
import { GET as getMeHandler } from "./me/route";
import { GET as getTeachersHandler } from "./teachers/route";
import { GET as getWalletBalanceHandler } from "./wallet/balance/route";
import { db } from "@/lib/db";
import { verifyAccessToken } from "@/lib/tokens";

vi.mock("@/lib/db", () => ({
  db: {
    user: {
      findUnique: vi.fn(),
    },
    studentProfile: {
      findUnique: vi.fn(),
    },
    teacherProfile: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    booking: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    classSession: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    coinTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/tokens", () => ({
  verifyAccessToken: vi.fn(),
}));

vi.mock("@/lib/livekit", () => ({
  generateLiveKitToken: vi.fn().mockResolvedValue({
    token: "mock_livekit_token",
    wsUrl: "wss://livekit.test.com",
  }),
}));

vi.mock("@/lib/coin-service", () => ({
  getCoinBalance: vi.fn().mockResolvedValue(750),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRedis: vi.fn().mockResolvedValue(false),
  exceedsMaxBodySize: vi.fn().mockReturnValue(false),
}));

describe("Mobile Versioned API Endpoints (/api/v1/*)", () => {
  const studentId = "11111111-2222-3333-4444-555555555555";
  const teacherId = "99999999-8888-7777-6666-555555555555";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/v1/classes", () => {
    it("rejects unauthenticated requests with 401", async () => {
      const req = new NextRequest("http://localhost/api/v1/classes");
      const res = await getClassesHandler(req);
      expect(res.status).toBe(401);
    });

    it("returns formatted bookings for authenticated student", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: studentId,
        role: "STUDENT",
        emailVerified: true,
      });

      const now = new Date();
      (db.booking.findMany as any).mockResolvedValue([
        {
          id: "booking-1",
          teacherId,
          studentId,
          amountPaid: 500,
          status: "CONFIRMED",
          createdAt: now,
          teacher: { name: "Maria Rodriguez", avatarUrl: null },
          student: { name: "Paarth Gupta" },
          sessions: [
            {
              scheduledStart: now,
              scheduledEnd: new Date(now.getTime() + 3600000),
            },
          ],
        },
      ]);
      (db.booking.count as any).mockResolvedValue(1);

      const req = new NextRequest("http://localhost/api/v1/classes?filter=upcoming", {
        headers: { Authorization: "Bearer valid_token" },
      });

      const res = await getClassesHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.total).toBe(1);
      expect(json.bookings[0].teacherName).toBe("Maria Rodriguez");
      expect(json.bookings[0].coinCost).toBe(500);
    });
  });

  describe("POST /api/v1/bookings", () => {
    it("enforces validation on request body", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: studentId,
        role: "STUDENT",
        emailVerified: true,
      });

      const req = new NextRequest("http://localhost/api/v1/bookings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ invalid: true }),
      });

      const res = await createBookingHandler(req);
      expect(res.status).toBe(400);
    });

    it("creates booking successfully and deducts coins", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: studentId,
        role: "STUDENT",
        emailVerified: true,
      });

      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const mockResult = {
        newBooking: {
          id: "b-new-1",
          teacherId,
          studentId,
          createdAt: new Date(),
          teacher: { name: "Maria Rodriguez", avatarUrl: null },
          student: { name: "Paarth Gupta" },
        },
        session: {
          scheduledStart: new Date(futureDate),
          scheduledEnd: new Date(new Date(futureDate).getTime() + 3600000),
        },
        totalCost: 500,
      };

      (db.$transaction as any).mockImplementation(async (cb: any) => {
        return cb({
          teacherProfile: {
            findUnique: vi.fn().mockResolvedValue({
              userId: teacherId,
              name: "Maria Rodriguez",
              status: "APPROVED",
              rates: [{ amount: 500, type: "HOURLY" }],
            }),
          },
          coinTransaction: {
            findMany: vi.fn().mockResolvedValue([{ amount: 1500 }]),
            create: vi.fn().mockResolvedValue({ id: "tx-1" }),
          },
          booking: {
            create: vi.fn().mockResolvedValue(mockResult.newBooking),
          },
          classSession: {
            create: vi.fn().mockResolvedValue(mockResult.session),
          },
        });
      });

      const req = new NextRequest("http://localhost/api/v1/bookings", {
        method: "POST",
        headers: {
          Authorization: "Bearer valid_token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          teacherId,
          slotStart: futureDate,
          durationMinutes: 60,
        }),
      });

      const res = await createBookingHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.id).toBe("b-new-1");
      expect(json.coinCost).toBe(500);
      expect(json.teacherName).toBe("Maria Rodriguez");
    });
  });

  describe("POST /api/v1/classes/[id]/token", () => {
    it("returns scoped LiveKit WebRTC token for valid student", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: studentId,
        role: "STUDENT",
        emailVerified: true,
      });

      (db.classSession.findUnique as any).mockResolvedValue({
        id: "session-123",
        status: "SCHEDULED",
        booking: {
          studentId,
          student: { name: "Paarth Gupta" },
        },
      });

      (db.classSession.update as any).mockResolvedValue({});

      const req = new NextRequest("http://localhost/api/v1/classes/session-123/token", {
        method: "POST",
        headers: { Authorization: "Bearer valid_token" },
      });

      const res = await getLiveKitTokenHandler(req, {
        params: Promise.resolve({ id: "session-123" }),
      });

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.token).toBe("mock_livekit_token");
      expect(json.roomName).toBe("class-session-123");
      expect(json.participantIdentity).toBe(studentId);
    });

    it("rejects access if student is not owner of session", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: "other-student-id",
        role: "STUDENT",
        emailVerified: true,
      });

      (db.classSession.findUnique as any).mockResolvedValue({
        id: "session-123",
        status: "SCHEDULED",
        booking: {
          studentId,
          student: { name: "Paarth Gupta" },
        },
      });

      const req = new NextRequest("http://localhost/api/v1/classes/session-123/token", {
        method: "POST",
        headers: { Authorization: "Bearer valid_token" },
      });

      const res = await getLiveKitTokenHandler(req, {
        params: Promise.resolve({ id: "session-123" }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/v1/me", () => {
    it("returns student profile and balance", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: studentId,
        role: "STUDENT",
        emailVerified: true,
      });

      (db.user.findUnique as any).mockResolvedValue({
        id: studentId,
        email: "student@languagemetrics.com",
        role: "STUDENT",
        createdAt: new Date("2026-01-01"),
      });

      (db.studentProfile.findUnique as any).mockResolvedValue({
        name: "Paarth Gupta",
        avatarUrl: null,
        languageToLearn: "Spanish",
        proficiencyLevel: "B1",
        status: "ACTIVE",
      });

      (db.coinTransaction.findMany as any).mockResolvedValue([
        { amount: 1000 },
        { amount: -200 },
      ]);

      const req = new NextRequest("http://localhost/api/v1/me", {
        headers: { Authorization: "Bearer valid_token" },
      });

      const res = await getMeHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.name).toBe("Paarth Gupta");
      expect(json.coinBalance).toBe(800);
      expect(json.languageToLearn).toBe("Spanish");
    });
  });

  describe("GET /api/v1/teachers", () => {
    it("returns teacher discovery list matching filters", async () => {
      (db.teacherProfile.findMany as any).mockResolvedValue([
        {
          userId: teacherId,
          name: "Jean Dupont",
          avatarUrl: null,
          bio: "French native teacher with 10 years experience",
          languages: ["French", "English"],
          rates: [{ amount: 600, type: "HOURLY" }],
          reviews: [{ rating: 5 }, { rating: 5 }],
        },
      ]);
      (db.teacherProfile.count as any).mockResolvedValue(1);

      const req = new NextRequest("http://localhost/api/v1/teachers?language=French&limit=10");
      const res = await getTeachersHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.teachers.length).toBe(1);
      expect(json.teachers[0].name).toBe("Jean Dupont");
      expect(json.teachers[0].hourlyRate).toBe(600);
      expect(json.teachers[0].rating).toBe(5);
    });
  });

  describe("GET /api/v1/wallet/balance", () => {
    it("returns calculated coin balance", async () => {
      (verifyAccessToken as any).mockResolvedValue({
        sub: studentId,
        role: "STUDENT",
        emailVerified: true,
      });

      (db.coinTransaction.findMany as any).mockResolvedValue([
        { amount: 500 },
        { amount: 250 },
      ]);

      const req = new NextRequest("http://localhost/api/v1/wallet/balance", {
        headers: { Authorization: "Bearer valid_token" },
      });

      const res = await getWalletBalanceHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.balance).toBe(750);
      expect(json.currency).toBe("INR");
    });
  });
});

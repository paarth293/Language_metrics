import { describe, test, expect, vi, beforeEach } from "vitest";
import { evaluateJoin } from "@repo/live-classes";

// Mock the dependencies used by evaluateJoin
vi.mock("@repo/database", () => {
  return {
    db: {
      classSession: {
        findUnique: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  };
});

vi.mock("@repo/livekit", () => {
  return {
    getLiveKitConfig: vi.fn(() => ({
      joinWindowMinutes: 5,
      graceMinutes: 10,
    })),
  };
});

import { db } from "@repo/database";
import { getLiveKitConfig } from "@repo/livekit";

describe("Video Route Security & RBAC (Step E & G)", () => {
  const baseNow = new Date("2026-09-20T10:00:00Z");
  
  const sampleSession = {
    id: "sess-100",
    status: "SCHEDULED",
    scheduledStart: new Date("2026-09-20T10:00:00Z"), // exactly now
    scheduledEnd: new Date("2026-09-20T11:00:00Z"),
    booking: {
      id: "booking-001",
      teacherId: "teacher-alice",
      studentId: "student-bob",
      status: "CONFIRMED",
      amountPaid: 100,
      student: { userId: "student-bob", name: "Bob" },
      teacher: { userId: "teacher-alice", name: "Alice" }
    },
    billing: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (db.classSession.findUnique as any).mockResolvedValue(sampleSession);
  });

  describe("E1: Participant Authorization & Isolation", () => {
    test("allows assigned teacher to access video token", async () => {
      const result = await evaluateJoin({
        userId: "teacher-alice",
        role: "TEACHER",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.role).toBe("TEACHER");
      }
    });

    test("allows enrolled student to access video token", async () => {
      const result = await evaluateJoin({
        userId: "student-bob",
        role: "STUDENT",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.role).toBe("STUDENT");
      }
    });

    test("rejects unauthorized teacher trying to join another teacher's session (IDOR protection)", async () => {
      const result = await evaluateJoin({
        userId: "teacher-mallory", // Attacker
        role: "TEACHER",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(403);
        expect(result.message).toContain("not a participant");
      }
    });

    test("rejects unenrolled student trying to join class", async () => {
      const result = await evaluateJoin({
        userId: "student-eve", // Not enrolled
        role: "STUDENT",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(403);
        expect(result.message).toContain("not a participant");
      }
    });

    test("returns 404 if booking does not exist", async () => {
      (db.classSession.findUnique as any).mockResolvedValue(null);
      
      const result = await evaluateJoin({
        userId: "teacher-alice",
        role: "TEACHER",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(404);
      }
    });
  });

  describe("Participant Sync & Room Alignment", () => {
    test("both teacher and student receive identical room identifier for participant sync", async () => {
      const teacherRes = await evaluateJoin({
        userId: "teacher-alice",
        role: "TEACHER",
        classSessionId: "sess-100",
        now: baseNow
      });

      const studentRes = await evaluateJoin({
        userId: "student-bob",
        role: "STUDENT",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(teacherRes.ok).toBe(true);
      expect(studentRes.ok).toBe(true);
      if (teacherRes.ok && studentRes.ok) {
        expect(teacherRes.classSessionId).toBe("sess-100");
        expect(studentRes.classSessionId).toBe("sess-100");
        expect(teacherRes.classSessionId).toBe(studentRes.classSessionId);
      }
    });
  });

  describe("Step G: Error Scenarios & Teacher Cancellation", () => {
    test("rejects token generation on cancelled bookings", async () => {
      (db.classSession.findUnique as any).mockResolvedValue({
        ...sampleSession,
        status: "CANCELLED",
        booking: {
          ...sampleSession.booking,
          status: "CANCELLED"
        }
      });

      const result = await evaluateJoin({
        userId: "student-bob",
        role: "STUDENT",
        classSessionId: "sess-100",
        now: baseNow
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.httpStatus).toBe(410);
        expect(result.message).toContain("cancelled");
      }
    });
  });
});

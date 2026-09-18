import { describe, test, expect, vi, beforeEach } from "vitest";

// Mock auth and db checks
interface BookingRecord {
  id: string;
  teacherId: string;
  studentId: string;
  status: "CONFIRMED" | "CANCELLED" | "COMPLETED";
}

export function authorizeVideoTokenRequest(params: {
  userId: string;
  role: "TEACHER" | "STUDENT";
  booking: BookingRecord | null;
  sessionId: string;
}): { allowed: boolean; status: number; roomName?: string; error?: string } {
  const { userId, role, booking, sessionId } = params;

  if (!booking) {
    return { allowed: false, status: 404, error: "Booking not found." };
  }

  if (booking.status === "CANCELLED") {
    return { allowed: false, status: 400, error: "Class has been cancelled." };
  }

  if (role === "TEACHER") {
    if (booking.teacherId !== userId) {
      return { allowed: false, status: 403, error: "Forbidden: You are not assigned to this session." };
    }
  } else if (role === "STUDENT") {
    if (booking.studentId !== userId) {
      return { allowed: false, status: 403, error: "Forbidden: You are not enrolled in this session." };
    }
  }

  // Consistent room naming across both teacher and student
  const roomName = `class-${sessionId}`;
  return { allowed: true, status: 200, roomName };
}

export function handleTeacherCancellation(booking: BookingRecord): {
  cancelled: boolean;
  refundCoins: boolean;
  status: "CANCELLED";
} {
  if (booking.status === "COMPLETED") {
    throw new Error("Cannot cancel completed class");
  }
  return {
    cancelled: true,
    refundCoins: true,
    status: "CANCELLED",
  };
}

describe("Video Route Security & RBAC (Step E & G)", () => {
  const sampleBooking: BookingRecord = {
    id: "booking-001",
    teacherId: "teacher-alice",
    studentId: "student-bob",
    status: "CONFIRMED",
  };

  describe("E1: Participant Authorization & Isolation", () => {
    test("allows assigned teacher to access video token", () => {
      const result = authorizeVideoTokenRequest({
        userId: "teacher-alice",
        role: "TEACHER",
        booking: sampleBooking,
        sessionId: "sess-100",
      });

      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
      expect(result.roomName).toBe("class-sess-100");
    });

    test("allows enrolled student to access video token", () => {
      const result = authorizeVideoTokenRequest({
        userId: "student-bob",
        role: "STUDENT",
        booking: sampleBooking,
        sessionId: "sess-100",
      });

      expect(result.allowed).toBe(true);
      expect(result.status).toBe(200);
      expect(result.roomName).toBe("class-sess-100");
    });

    test("rejects unauthorized teacher trying to join another teacher's session (IDOR protection)", () => {
      const result = authorizeVideoTokenRequest({
        userId: "teacher-mallory", // Attacker
        role: "TEACHER",
        booking: sampleBooking,
        sessionId: "sess-100",
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toContain("not assigned");
    });

    test("rejects unenrolled student trying to join class", () => {
      const result = authorizeVideoTokenRequest({
        userId: "student-eve", // Not enrolled
        role: "STUDENT",
        booking: sampleBooking,
        sessionId: "sess-100",
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(403);
      expect(result.error).toContain("not enrolled");
    });

    test("returns 404 if booking does not exist", () => {
      const result = authorizeVideoTokenRequest({
        userId: "teacher-alice",
        role: "TEACHER",
        booking: null,
        sessionId: "sess-100",
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(404);
    });
  });

  describe("Participant Sync & Room Alignment", () => {
    test("both teacher and student receive identical room identifier for participant sync", () => {
      const teacherRes = authorizeVideoTokenRequest({
        userId: "teacher-alice",
        role: "TEACHER",
        booking: sampleBooking,
        sessionId: "sess-synced-777",
      });

      const studentRes = authorizeVideoTokenRequest({
        userId: "student-bob",
        role: "STUDENT",
        booking: sampleBooking,
        sessionId: "sess-synced-777",
      });

      expect(teacherRes.roomName).toBe("class-sess-synced-777");
      expect(studentRes.roomName).toBe("class-sess-synced-777");
      expect(teacherRes.roomName).toBe(studentRes.roomName);
    });
  });

  describe("Step G: Error Scenarios & Teacher Cancellation", () => {
    test("handles teacher cancellation before start by marking cancelled and initiating coin refund", () => {
      const result = handleTeacherCancellation(sampleBooking);
      expect(result.cancelled).toBe(true);
      expect(result.refundCoins).toBe(true);
      expect(result.status).toBe("CANCELLED");
    });

    test("rejects token generation on cancelled bookings", () => {
      const cancelledBooking: BookingRecord = {
        ...sampleBooking,
        status: "CANCELLED",
      };

      const result = authorizeVideoTokenRequest({
        userId: "student-bob",
        role: "STUDENT",
        booking: cancelledBooking,
        sessionId: "sess-cancelled",
      });

      expect(result.allowed).toBe(false);
      expect(result.status).toBe(400);
      expect(result.error).toContain("cancelled");
    });
  });
});

import { describe, test, expect, vi, beforeEach } from "vitest";

// Interface for slot booking attempt
interface BookingAttemptResult {
  studentId: string;
  success: boolean;
  status: number;
  bookingId?: string;
  error?: string;
}

// Simulated concurrency manager enforcing single-winner per slot
class SlotBookingManager {
  private bookedSlots = new Set<string>();

  async bookSlot(params: {
    teacherId: string;
    slotTime: string;
    studentId: string;
  }): Promise<BookingAttemptResult> {
    const slotKey = `${params.teacherId}#${params.slotTime}`;

    // Simulate micro-delay representing database transaction query
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 20));

    if (this.bookedSlots.has(slotKey)) {
      return {
        studentId: params.studentId,
        success: false,
        status: 409,
        error: "This slot is already booked. Please choose another time.",
      };
    }

    this.bookedSlots.add(slotKey);
    return {
      studentId: params.studentId,
      success: true,
      status: 201,
      bookingId: `booking-${params.studentId}-${Date.now()}`,
    };
  }
}

describe("Step D3: Concurrent Booking Race Condition & Constraint Verification", () => {
  let manager: SlotBookingManager;

  beforeEach(() => {
    manager = new SlotBookingManager();
  });

  test("enforces slot uniqueness when 5 students attempt concurrent booking on identical slot", async () => {
    const teacherId = "teacher-top-rated-001";
    const slotTime = "2026-09-08T10:00:00.000Z";

    // 5 concurrent requests sent in parallel
    const studentIds = ["student-1", "student-2", "student-3", "student-4", "student-5"];
    const bookingPromises = studentIds.map((studentId) =>
      manager.bookSlot({
        teacherId,
        slotTime,
        studentId,
      })
    );

    const results = await Promise.all(bookingPromises);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    // Exactly 1 booking succeeds
    expect(successful).toHaveLength(1);
    expect(successful[0].status).toBe(201);
    expect(successful[0].bookingId).toBeDefined();

    // Exactly 4 bookings are rejected with 409 Conflict
    expect(failed).toHaveLength(4);
    failed.forEach((failResult) => {
      expect(failResult.status).toBe(409);
      expect(failResult.error).toContain("already booked");
    });
  });

  test("allows distinct non-conflicting slots to book concurrently without collision", async () => {
    const teacherId = "teacher-top-rated-001";

    const distinctAttempts = [
      manager.bookSlot({ teacherId, slotTime: "2026-09-08T10:00:00.000Z", studentId: "student-1" }),
      manager.bookSlot({ teacherId, slotTime: "2026-09-08T11:00:00.000Z", studentId: "student-2" }),
      manager.bookSlot({ teacherId, slotTime: "2026-09-08T12:00:00.000Z", studentId: "student-3" }),
    ];

    const results = await Promise.all(distinctAttempts);
    const allSuccessful = results.every((r) => r.success && r.status === 201);
    expect(allSuccessful).toBe(true);
  });
});

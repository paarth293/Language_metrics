import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  STUDENT_CANCEL_REFUSAL_CODE,
  STUDENT_CANCEL_WINDOW_HOURS,
} from "@repo/live-classes";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const OTHER_STUDENT = "99999999-9999-4999-8999-999999999999";
const BOOKING = "b1b1b1b1-0000-4000-8000-000000000001";

/** Fixed server clock. Every case is expressed relative to this. */
const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

type Session = { id: string; scheduledStart: Date; scheduledEnd: Date; status: string };
type Booking = { id: string; studentId: string; status: string; sessions: Session[] };

const state = vi.hoisted(() => ({
  booking: null as unknown,
  cancelCalls: [] as unknown[][],
  limited: false,
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ user: { sub: STUDENT, role: "STUDENT" } }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRedis: async () => state.limited,
}));

vi.mock("@/lib/db", () => ({
  prisma: { booking: { findUnique: async () => state.booking } },
}));

// The real cancel-window rule is kept; only the coin-moving call is faked, so
// this test proves the route uses the shared rule rather than its own copy.
vi.mock("@repo/live-classes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/live-classes")>();
  return {
    ...actual,
    cancelBookingAndReturnCoins: async (...args: unknown[]) => {
      state.cancelCalls.push(args);
      return { returnedCoins: 500 };
    },
  };
});

/** A confirmed booking for our student whose only class starts in `hours`. */
const bookingStartingIn = (hours: number, overrides: Partial<Booking> = {}): Booking => {
  const start = new Date(NOW.getTime() + hours * HOUR);
  return {
    id: BOOKING,
    studentId: STUDENT,
    status: "CONFIRMED",
    sessions: [
      {
        id: "5e551011-0000-4000-8000-000000000001",
        scheduledStart: start,
        scheduledEnd: new Date(start.getTime() + HOUR),
        status: "SCHEDULED",
      },
    ],
    ...overrides,
  };
};

const cancel = async () => {
  const { POST } = await import("./route");
  const res = await POST(
    new NextRequest(`http://localhost/api/students/classes/${BOOKING}/cancel`, { method: "POST" }),
    { params: Promise.resolve({ id: BOOKING }) }
  );
  return { res, body: await res.json() };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.cancelCalls.length = 0;
  state.limited = false;
  state.booking = bookingStartingIn(24);
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/students/classes/[id]/cancel — the 4-hour window", () => {
  it("allows a cancel five hours before the class", async () => {
    state.booking = bookingStartingIn(5);
    const { res, body } = await cancel();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.cancelCalls).toHaveLength(1);
  });

  it("allows a cancel at exactly four hours", async () => {
    state.booking = bookingStartingIn(STUDENT_CANCEL_WINDOW_HOURS);
    const { res } = await cancel();

    expect(res.status).toBe(200);
    expect(state.cancelCalls).toHaveLength(1);
  });

  it("refuses a cancel at three hours fifty-nine minutes, with the deadline in the body", async () => {
    const start = new Date(NOW.getTime() + 3 * HOUR + 59 * 60_000);
    state.booking = bookingStartingIn(0, {
      sessions: [
        {
          id: "s1",
          scheduledStart: start,
          scheduledEnd: new Date(start.getTime() + HOUR),
          status: "SCHEDULED",
        },
      ],
    });

    const { res, body } = await cancel();

    expect(res.status).toBe(409);
    expect(body.code).toBe(STUDENT_CANCEL_REFUSAL_CODE);
    // The deadline that has just passed: four hours before this class.
    expect(body.cancelClosesAt).toBe(new Date(start.getTime() - 4 * HOUR).toISOString());
    expect(typeof body.error).toBe("string");
    expect(body.error.length).toBeGreaterThan(0);
    // Nothing was refunded.
    expect(state.cancelCalls).toHaveLength(0);
  });

  it("refuses a cancel after the class has started", async () => {
    state.booking = bookingStartingIn(-1);
    const { res, body } = await cancel();

    expect(res.status).toBe(409);
    expect(body.code).toBe(STUDENT_CANCEL_REFUSAL_CODE);
    expect(state.cancelCalls).toHaveLength(0);
  });

  it("keeps the refusal body backward compatible by still sending `error`", async () => {
    state.booking = bookingStartingIn(1);
    const { body } = await cancel();

    expect(body).toHaveProperty("error");
    expect(body.error).toContain(String(STUDENT_CANCEL_WINDOW_HOURS));
  });
});

describe("POST /api/students/classes/[id]/cancel — everything around the window", () => {
  it("still releases the coin hold exactly as before on an allowed cancel", async () => {
    state.booking = bookingStartingIn(48);
    await cancel();

    // Same function, same arguments as before this change: the booking id and
    // the short reason string.
    expect(state.cancelCalls).toEqual([[BOOKING, `Cancelled booking #${BOOKING.slice(0, 8)}`]]);
  });

  it("is idempotent: a second cancel refunds nothing again", async () => {
    state.booking = bookingStartingIn(48, { status: "CANCELLED" });
    const { res, body } = await cancel();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already cancelled/i);
    expect(state.cancelCalls).toHaveLength(0);
  });

  it("refuses to cancel a completed booking", async () => {
    state.booking = bookingStartingIn(-48, { status: "COMPLETED" });
    const { res, body } = await cancel();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/completed/i);
    expect(state.cancelCalls).toHaveLength(0);
  });

  it("does not let a student cancel someone else's booking", async () => {
    // Far enough out that the window would otherwise allow it.
    state.booking = bookingStartingIn(48, { studentId: OTHER_STUDENT });
    const { res } = await cancel();

    expect(res.status).toBe(403);
    expect(state.cancelCalls).toHaveLength(0);
  });

  it("returns 404 for a booking that does not exist", async () => {
    state.booking = null;
    const { res } = await cancel();

    expect(res.status).toBe(404);
    expect(state.cancelCalls).toHaveLength(0);
  });

  it("allows a cancel when the booking has no session at all", async () => {
    state.booking = bookingStartingIn(48, { sessions: [] });
    const { res } = await cancel();

    expect(res.status).toBe(200);
    expect(state.cancelCalls).toHaveLength(1);
  });
});

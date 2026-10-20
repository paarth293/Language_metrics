import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { STUDENT_CANCEL_WINDOW_HOURS } from "@repo/live-classes";

/**
 * A teacher cancelling their own class.
 *
 * Unlike a student cancel this is not fenced by the 4-hour window: a teacher
 * who cannot teach cannot teach, and holding them to a deadline would only
 * mean the class is silently missed instead of cancelled — with the student's
 * coins still held either way. So the obligations run the other way round: the
 * student must get every coin back, and must be told.
 *
 * Everything below is timed against one fixed clock, so "an hour before the
 * class" means the same thing on every machine and in every month.
 */
const TEACHER = "aaaaaaaa-1111-4111-8111-111111111111";
const OTHER_TEACHER = "bbbbbbbb-2222-4222-8222-222222222222";
const STUDENT = "11111111-1111-4111-8111-111111111111";
const SESSION = "5e551011-0000-4000-8000-000000000001";
const BOOKING = "b1b1b1b1-0000-4000-8000-000000000001";

const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

type Session = {
  id: string;
  status: string;
  bookingId: string;
  scheduledStart: Date;
  booking: { teacherId: string; studentId: string };
};

const state = vi.hoisted(() => ({
  session: null as unknown,
  /** SessionBilling.status for this class, or null for no billing row. */
  billingStatus: "HELD" as string | null,
  /** How many rows the conditional status flip matched. */
  flipped: 1,
  refundCalls: [] as unknown[][],
  notifications: [] as Record<string, unknown>[],
  statusUpdates: [] as Record<string, unknown>[],
  logs: [] as Array<{ level: string; msg: string; fields?: Record<string, unknown> }>,
  rateLimited: false,
}));

vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ user: { sub: TEACHER, role: "TEACHER" } }),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimitRedis: async () => state.rateLimited,
}));

vi.mock("@repo/logger", () => {
  const logger = {
    debug: (msg: string, fields?: Record<string, unknown>) => state.logs.push({ level: "debug", msg, fields }),
    info: (msg: string, fields?: Record<string, unknown>) => state.logs.push({ level: "info", msg, fields }),
    warn: (msg: string, fields?: Record<string, unknown>) => state.logs.push({ level: "warn", msg, fields }),
    error: (msg: string, fields?: Record<string, unknown>) => state.logs.push({ level: "error", msg, fields }),
    child: () => logger,
  };
  return { requestLogger: () => logger, log: logger, createLogger: () => logger };
});

// Only the coin-moving call is faked. The route must reach for the shared
// release function rather than touching the ledger itself.
vi.mock("@repo/live-classes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@repo/live-classes")>();
  return {
    ...actual,
    refundSessionHold: async (...args: unknown[]) => {
      state.refundCalls.push(args);
    },
  };
});

const tx = {
  classSession: {
    updateMany: async (args: Record<string, unknown>) => {
      state.statusUpdates.push(args);
      return { count: state.flipped };
    },
  },
  sessionBilling: {
    findUnique: async () => (state.billingStatus ? { status: state.billingStatus } : null),
  },
  notification: {
    create: async (args: { data: Record<string, unknown> }) => {
      state.notifications.push(args.data);
      return args.data;
    },
  },
};

const fakeDb = {
  classSession: { findUnique: async () => state.session },
  $transaction: async (fn: (t: unknown) => unknown) => fn(tx),
};

vi.mock("@/lib/db", () => ({ db: fakeDb, prisma: fakeDb }));

/** A scheduled class of ours whose start is `hours` from the fixed clock. */
const sessionStartingIn = (hours: number, overrides: Partial<Session> = {}): Session => ({
  id: SESSION,
  status: "SCHEDULED",
  bookingId: BOOKING,
  scheduledStart: new Date(NOW.getTime() + hours * HOUR),
  booking: { teacherId: TEACHER, studentId: STUDENT },
  ...overrides,
});

const cancel = async () => {
  const { POST } = await import("./route");
  const res = await POST(
    new NextRequest(`http://localhost/api/teachers/sessions/${SESSION}/cancel`, { method: "POST" }),
    { params: Promise.resolve({ id: SESSION }) }
  );
  return { res, body: await res.json() };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  state.session = sessionStartingIn(24);
  state.billingStatus = "HELD";
  state.flipped = 1;
  state.refundCalls.length = 0;
  state.notifications.length = 0;
  state.statusUpdates.length = 0;
  state.logs.length = 0;
  state.rateLimited = false;
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("POST /api/teachers/sessions/[id]/cancel — the 4-hour window does not apply", () => {
  it("cancels a class starting in one hour, which a student would be refused", async () => {
    state.session = sessionStartingIn(1);
    const { res, body } = await cancel();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(state.refundCalls).toHaveLength(1);
  });

  it("cancels a class starting in one minute", async () => {
    state.session = sessionStartingIn(1 / 60);
    const { res } = await cancel();

    expect(res.status).toBe(200);
    expect(state.refundCalls).toHaveLength(1);
  });

  it("cancels well inside the window, and comfortably outside it, alike", async () => {
    for (const hours of [0.5, 2, STUDENT_CANCEL_WINDOW_HOURS, 48]) {
      state.refundCalls.length = 0;
      state.session = sessionStartingIn(hours);
      const { res } = await cancel();
      expect(res.status, `${hours}h before the class`).toBe(200);
      expect(state.refundCalls).toHaveLength(1);
    }
  });

  it("never reads the clock to decide, so no refusal can mention a deadline", async () => {
    state.session = sessionStartingIn(0.1);
    const { body } = await cancel();

    expect(body).not.toHaveProperty("cancelClosesAt");
    expect(body).not.toHaveProperty("code");
  });
});

describe("POST /api/teachers/sessions/[id]/cancel — the student's coins", () => {
  it("refunds through the same shared function a student cancel uses", async () => {
    await cancel();

    expect(state.refundCalls).toHaveLength(1);
    const [sessionId, reason, client] = state.refundCalls[0]!;
    expect(sessionId).toBe(SESSION);
    expect(typeof reason).toBe("string");
    expect((reason as string).length).toBeGreaterThan(0);
    // Handed the transaction, so the refund, the status flip and the student's
    // notification either all land or none do.
    expect(client).toBe(tx);
  });

  it("flips the status conditionally, so two concurrent cancels cannot both refund", async () => {
    await cancel();

    expect(state.statusUpdates).toHaveLength(1);
    expect(state.statusUpdates[0]).toMatchObject({
      where: { id: SESSION, status: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { status: "CANCELLED" },
    });
  });

  it("refunds nothing when the flip matched no row — the other caller got there first", async () => {
    state.flipped = 0;
    const { res } = await cancel();

    expect(res.status).toBe(409);
    expect(state.refundCalls).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });
});

describe("POST /api/teachers/sessions/[id]/cancel — whose class it is", () => {
  it("does not let a teacher cancel someone else's class", async () => {
    state.session = sessionStartingIn(24, {
      booking: { teacherId: OTHER_TEACHER, studentId: STUDENT },
    });
    const { res } = await cancel();

    expect(res.status).toBe(403);
    expect(state.refundCalls).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
    expect(state.statusUpdates).toHaveLength(0);
  });

  it("refuses someone else's class even when it is far outside the window", async () => {
    // Nothing about timing can turn this into a yes.
    state.session = sessionStartingIn(240, {
      booking: { teacherId: OTHER_TEACHER, studentId: STUDENT },
    });
    const { res } = await cancel();

    expect(res.status).toBe(403);
    expect(state.refundCalls).toHaveLength(0);
  });

  it("returns 404 for a class that does not exist", async () => {
    state.session = null;
    const { res } = await cancel();

    expect(res.status).toBe(404);
    expect(state.refundCalls).toHaveLength(0);
  });

  it("does not name the people involved in a refusal", async () => {
    state.session = sessionStartingIn(24, {
      booking: { teacherId: OTHER_TEACHER, studentId: STUDENT },
    });
    const { body } = await cancel();

    expect(JSON.stringify(body)).not.toContain(STUDENT);
    expect(JSON.stringify(body)).not.toContain(OTHER_TEACHER);
  });
});

describe("POST /api/teachers/sessions/[id]/cancel — telling the student", () => {
  it("writes the student an in-app notification", async () => {
    await cancel();

    expect(state.notifications).toHaveLength(1);
    expect(state.notifications[0]).toMatchObject({
      userId: STUDENT,
      type: "BOOKING_UPDATE",
    });
    expect(typeof state.notifications[0]!.title).toBe("string");
    expect(typeof state.notifications[0]!.message).toBe("string");
  });

  it("says the coins are back when a hold was actually released", async () => {
    state.billingStatus = "HELD";
    await cancel();

    expect(String(state.notifications[0]!.message)).toMatch(/coin/i);
  });

  it("does not promise coins back when there was no hold to release", async () => {
    // A legacy booking paid up front has no billing row, so refundSessionHold
    // returns without moving anything. Telling the student otherwise would be
    // a lie they would go looking for in their wallet.
    state.billingStatus = null;
    await cancel();

    expect(state.notifications).toHaveLength(1);
    expect(String(state.notifications[0]!.message)).not.toMatch(/coin/i);
  });

  it("notifies the student, never the teacher", async () => {
    await cancel();

    expect(state.notifications.map((n) => n.userId)).toEqual([STUDENT]);
  });
});

describe("POST /api/teachers/sessions/[id]/cancel — a second call", () => {
  it("refuses an already-cancelled class", async () => {
    state.session = sessionStartingIn(24, { status: "CANCELLED" });
    const { res, body } = await cancel();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/already cancelled/i);
    expect(state.refundCalls).toHaveLength(0);
  });

  it("refuses a completed class", async () => {
    state.session = sessionStartingIn(-24, { status: "COMPLETED" });
    const { res, body } = await cancel();

    expect(res.status).toBe(400);
    expect(body.error).toMatch(/completed/i);
    expect(state.refundCalls).toHaveLength(0);
  });

  it("notifies the student exactly once across two calls", async () => {
    await cancel();
    // The second call sees what the first wrote.
    state.session = sessionStartingIn(24, { status: "CANCELLED" });
    await cancel();

    expect(state.notifications).toHaveLength(1);
    expect(state.refundCalls).toHaveLength(1);
  });
});

describe("POST /api/teachers/sessions/[id]/cancel — the log", () => {
  it("logs the cancel", async () => {
    await cancel();

    const lines = state.logs.filter((l) => l.level === "info");
    expect(lines).toHaveLength(1);
    expect(lines[0]!.fields).toMatchObject({ sessionId: SESSION, bookingId: BOOKING });
  });

  it("records whether coins were actually released", async () => {
    await cancel();
    expect(state.logs.find((l) => l.level === "info")!.fields).toMatchObject({ refunded: true });

    state.logs.length = 0;
    state.billingStatus = null;
    state.session = sessionStartingIn(24);
    await cancel();
    expect(state.logs.find((l) => l.level === "info")!.fields).toMatchObject({ refunded: false });
  });

  it("carries no personal data: no user ids, names, emails or amounts", async () => {
    await cancel();

    const written = JSON.stringify(state.logs);
    // The two ids in the line point at a booking, which is where the people
    // involved are recorded. The log itself names nobody.
    expect(written).not.toContain(STUDENT);
    expect(written).not.toContain(TEACHER);
    expect(written).not.toMatch(/@/);
    expect(written).not.toMatch(/coins/i);
  });

  it("logs nothing about a class that is not this teacher's beyond the refusal", async () => {
    state.session = sessionStartingIn(24, {
      booking: { teacherId: OTHER_TEACHER, studentId: STUDENT },
    });
    await cancel();

    const written = JSON.stringify(state.logs);
    expect(written).not.toContain(STUDENT);
    expect(written).not.toContain(OTHER_TEACHER);
    expect(state.logs.filter((l) => l.level === "info")).toHaveLength(0);
  });
});

describe("POST /api/teachers/sessions/[id]/cancel — rate limiting", () => {
  it("refuses a flood without touching the ledger", async () => {
    state.rateLimited = true;
    const { res } = await cancel();

    expect(res.status).toBe(429);
    expect(state.refundCalls).toHaveLength(0);
    expect(state.notifications).toHaveLength(0);
  });
});

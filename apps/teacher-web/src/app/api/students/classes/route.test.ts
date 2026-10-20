import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDENT_CANCEL_WINDOW_MS } from "@repo/live-classes";

const STUDENT = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;

type Session = { id: string; scheduledStart: Date; scheduledEnd: Date; status: string; recordingUrl: string | null };

const state = vi.hoisted(() => ({ bookings: [] as unknown[] }));

vi.mock("@/lib/auth", () => ({
  requireAuth: async () => ({ user: { sub: STUDENT, role: "STUDENT" } }),
}));

vi.mock("@/lib/db", () => ({
  db: { booking: { findMany: async () => state.bookings } },
}));

const session = (hoursFromNow: number, overrides: Partial<Session> = {}): Session => {
  const start = new Date(NOW.getTime() + hoursFromNow * HOUR);
  return {
    id: `s-${hoursFromNow}`,
    scheduledStart: start,
    scheduledEnd: new Date(start.getTime() + HOUR),
    status: "SCHEDULED",
    recordingUrl: null,
    ...overrides,
  };
};

const booking = (sessions: Session[]) => ({
  id: "b0000011-0000-4000-8000-000000000001",
  type: "HOURLY",
  status: "CONFIRMED",
  amountPaid: 500,
  createdAt: NOW,
  teacher: { name: "Aiko Tanaka", avatarUrl: null, language: "Japanese", languages: ["Japanese"] },
  sessions,
  review: null,
});

const list = async () => {
  const { GET } = await import("./route");
  const res = await GET(new Request("http://localhost/api/students/classes?filter=upcoming"));
  return { res, body: await res.json() };
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.resetModules();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/students/classes — cancelClosesAt", () => {
  it("sends the cancellation deadline, four hours before the class", async () => {
    const upcoming = session(24);
    state.bookings = [booking([upcoming])];

    const { res, body } = await list();

    expect(res.status).toBe(200);
    expect(body.bookings[0].cancelClosesAt).toBe(
      new Date(upcoming.scheduledStart.getTime() - STUDENT_CANCEL_WINDOW_MS).toISOString()
    );
  });

  it("measures it from the booking's first session, which is what the cancel route enforces", async () => {
    // A course booking: the first class has already happened, so the cancel
    // route — which reads sessions[0] — refuses. The deadline sent to the UI
    // has to describe that same session, or the button and the server disagree.
    const first = session(-48, { status: "COMPLETED" });
    const next = session(72);
    state.bookings = [booking([first, next])];

    const { body } = await list();

    expect(body.bookings[0].cancelClosesAt).toBe(
      new Date(first.scheduledStart.getTime() - STUDENT_CANCEL_WINDOW_MS).toISOString()
    );
    // Not the upcoming session the Join button uses.
    expect(body.bookings[0].nextSession.scheduledStart).toBe(next.scheduledStart.toISOString());
  });

  it("sends null when the booking has no session, which the route treats as cancellable", async () => {
    state.bookings = [booking([])];

    const { body } = await list();

    expect(body.bookings[0].cancelClosesAt).toBeNull();
  });

  it("leaves the rest of the booking shape alone", async () => {
    state.bookings = [booking([session(24)])];

    const { body } = await list();
    const row = body.bookings[0];

    expect(row.id).toBe("b0000011-0000-4000-8000-000000000001");
    expect(row.teacher).toBe("Aiko Tanaka");
    expect(row.language).toBe("Japanese");
    expect(row.totalSessions).toBe(1);
    expect(row.nextSession).toMatchObject({ joinOpensAt: expect.any(String), joinClosesAt: expect.any(String) });
  });
});

import { describe, test, expect } from "vitest";

// Domain logic functions for session management
export function calculateSessionDurationMinutes(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diffMs / (1000 * 60)));
}

export function isSessionAccessible(session: { scheduledStart: Date; scheduledEnd: Date }, now = new Date()): boolean {
  // Can join up to 10 minutes before and until scheduled end
  const bufferMs = 10 * 60 * 1000;
  const startWindow = new Date(session.scheduledStart.getTime() - bufferMs);
  return now >= startWindow && now <= session.scheduledEnd;
}

export function transitionSessionStatus(
  current: "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED",
  action: "START" | "END" | "CANCEL"
): "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED" {
  if (action === "CANCEL") {
    if (current === "COMPLETED") throw new Error("Cannot cancel completed session");
    return "CANCELLED";
  }
  if (action === "START") {
    if (current !== "SCHEDULED") throw new Error(`Cannot start session from state: ${current}`);
    return "ONGOING";
  }
  if (action === "END") {
    if (current !== "ONGOING") throw new Error(`Cannot end session from state: ${current}`);
    return "COMPLETED";
  }
  return current;
}

describe("ClassSession Management (teacher-web)", () => {
  describe("Duration Calculation", () => {
    test("calculates duration accurately for standard 50-minute class", () => {
      const start = new Date("2026-09-07T14:00:00Z");
      const end = new Date("2026-09-07T14:50:00Z");
      expect(calculateSessionDurationMinutes(start, end)).toBe(50);
    });

    test("handles zero duration or invalid end time safely", () => {
      const start = new Date("2026-09-07T14:00:00Z");
      const end = new Date("2026-09-07T13:50:00Z");
      expect(calculateSessionDurationMinutes(start, end)).toBe(0);
    });
  });

  describe("Session Accessibility Window", () => {
    const session = {
      scheduledStart: new Date("2026-09-07T15:00:00Z"),
      scheduledEnd: new Date("2026-09-07T16:00:00Z"),
    };

    test("allows participant to join 10 minutes prior to scheduledStart", () => {
      const earlyTime = new Date("2026-09-07T14:50:00Z");
      expect(isSessionAccessible(session, earlyTime)).toBe(true);
    });

    test("rejects access too early (> 10 minutes before)", () => {
      const tooEarlyTime = new Date("2026-09-07T14:45:00Z");
      expect(isSessionAccessible(session, tooEarlyTime)).toBe(false);
    });

    test("allows access during ongoing session", () => {
      const duringTime = new Date("2026-09-07T15:30:00Z");
      expect(isSessionAccessible(session, duringTime)).toBe(true);
    });

    test("rejects access after scheduledEnd has passed", () => {
      const afterTime = new Date("2026-09-07T16:05:00Z");
      expect(isSessionAccessible(session, afterTime)).toBe(false);
    });
  });

  describe("Session Status State Transitions", () => {
    test("transitions SCHEDULED -> ONGOING on START", () => {
      expect(transitionSessionStatus("SCHEDULED", "START")).toBe("ONGOING");
    });

    test("transitions ONGOING -> COMPLETED on END", () => {
      expect(transitionSessionStatus("ONGOING", "END")).toBe("COMPLETED");
    });

    test("transitions SCHEDULED -> CANCELLED on CANCEL", () => {
      expect(transitionSessionStatus("SCHEDULED", "CANCEL")).toBe("CANCELLED");
    });

    test("throws error if starting an already COMPLETED session", () => {
      expect(() => transitionSessionStatus("COMPLETED", "START")).toThrow();
    });

    test("throws error if ending a SCHEDULED session before starting", () => {
      expect(() => transitionSessionStatus("SCHEDULED", "END")).toThrow();
    });
  });
});

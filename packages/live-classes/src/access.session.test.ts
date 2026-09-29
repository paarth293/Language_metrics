import { describe, it, expect } from "vitest";
import { currentOrNextSession } from "./access";

const min = 60_000;
const start = new Date("2026-09-29T16:40:00Z");
const end = new Date(start.getTime() + 45 * min);

const s = (id: string, status: string, offsetMin = 0) => ({
  id,
  status,
  scheduledStart: new Date(start.getTime() + offsetMin * min),
  scheduledEnd: new Date(end.getTime() + offsetMin * min),
});

describe("currentOrNextSession", () => {
  it("keeps a class that has started but nobody joined yet", () => {
    // The dashboard bug: 5 minutes in, still SCHEDULED, and it vanished on refresh.
    expect(currentOrNextSession([s("a", "SCHEDULED")], new Date(start.getTime() + 5 * min))?.id).toBe("a");
  });

  it("keeps a class that is in progress", () => {
    expect(currentOrNextSession([s("a", "ONGOING")], new Date(start.getTime() + 30 * min))?.id).toBe("a");
  });

  it("keeps it through the grace period after the end, then drops it", () => {
    expect(currentOrNextSession([s("a", "SCHEDULED")], new Date(end.getTime() + 9 * min))?.id).toBe("a");
    expect(currentOrNextSession([s("a", "SCHEDULED")], new Date(end.getTime() + 11 * min))).toBeUndefined();
  });

  it("drops finished and cancelled classes", () => {
    const now = new Date(start.getTime() + 5 * min);
    expect(currentOrNextSession([s("a", "COMPLETED"), s("b", "CANCELLED")], now)).toBeUndefined();
  });

  it("returns the soonest one regardless of input order", () => {
    const now = new Date(start.getTime() - 60 * min);
    expect(currentOrNextSession([s("later", "SCHEDULED", 120), s("sooner", "SCHEDULED")], now)?.id).toBe("sooner");
  });
});

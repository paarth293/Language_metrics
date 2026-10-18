import { describe, expect, it } from "vitest";
import {
  type ScheduleSession,
  formatWeekRange,
  getHourRange,
  getSessionTone,
  layoutDay,
  startOfWeek,
} from "./schedule-utils";

function session(id: string, start: Date, minutes: number, extra: Partial<ScheduleSession> = {}): ScheduleSession {
  return {
    id,
    status: "SCHEDULED",
    scheduledStart: start.toISOString(),
    scheduledEnd: new Date(start.getTime() + minutes * 60_000).toISOString(),
    booking: { id: `b-${id}`, status: "CONFIRMED", type: "HOURLY" },
    student: { userId: `u-${id}`, name: `Student ${id}`, avatarUrl: null, proficiencyLevel: "A1" },
    ...extra,
  };
}

const at = (h: number, m = 0) => new Date(2026, 8, 30, h, m);

describe("layoutDay", () => {
  it("keeps non-overlapping classes full width", () => {
    const out = layoutDay([session("a", at(9), 45), session("b", at(10), 45)]);
    expect(out.map((p) => [p.session.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 1],
      ["b", 0, 1],
    ]);
  });

  it("splits overlapping classes into side-by-side lanes", () => {
    const out = layoutDay([session("a", at(9), 60), session("b", at(9, 30), 60), session("c", at(9, 45), 30)]);
    expect(out.map((p) => [p.session.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 3],
      ["b", 1, 3],
      ["c", 2, 3],
    ]);
  });

  it("reuses a freed lane and only widens its own cluster", () => {
    const out = layoutDay([
      session("a", at(9), 60),
      session("b", at(9, 30), 60),
      session("c", at(10), 30), // lane 0 is free again at 10:00
      session("d", at(14), 60), // separate cluster
    ]);
    expect(out.map((p) => [p.session.id, p.lane, p.lanes])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
      ["d", 0, 1],
    ]);
  });
});

describe("getHourRange", () => {
  it("defaults to a working day when nothing is booked or set", () => {
    expect(getHourRange([], [])).toEqual([8, 20]);
  });

  it("covers classes and availability with an hour of padding", () => {
    const range = getHourRange([session("a", at(7), 45)], [{ dayOfWeek: 2, startTime: "09:00", endTime: "19:30" }]);
    expect(range).toEqual([6, 21]);
  });

  it("clamps to the day and runs to midnight for classes that cross it", () => {
    const range = getHourRange([session("a", at(23, 30), 60)], []);
    expect(range[1]).toBe(24);
    expect(range[1] - range[0]).toBeGreaterThanOrEqual(10);
  });
});

describe("getSessionTone", () => {
  const start = at(10);
  const s = session("a", start, 45);

  it("tracks the join window", () => {
    expect(getSessionTone(s, start.getTime() - 3 * 3600_000)).toBe("upcoming");
    expect(getSessionTone(s, start.getTime() - 30 * 60_000)).toBe("soon");
    expect(getSessionTone(s, start.getTime())).toBe("open");
    expect(getSessionTone({ ...s, status: "ONGOING" }, start.getTime())).toBe("live");
    expect(getSessionTone(s, start.getTime() + 3 * 3600_000)).toBe("ended");
  });

  it("reports final and pending states", () => {
    const later = start.getTime() - 3 * 3600_000;
    expect(getSessionTone({ ...s, status: "COMPLETED" }, later)).toBe("completed");
    expect(getSessionTone({ ...s, status: "CANCELLED" }, later)).toBe("cancelled");
    expect(getSessionTone({ ...s, booking: { ...s.booking, status: "CANCELLED" } }, later)).toBe("cancelled");
    expect(getSessionTone({ ...s, booking: { ...s.booking, status: "PENDING" } }, later)).toBe("pending");
  });
});

describe("week helpers", () => {
  it("starts weeks on Monday", () => {
    expect(startOfWeek(new Date(2026, 8, 29)).getDate()).toBe(28); // Tue 29 Sep -> Mon 28 Sep
    expect(startOfWeek(new Date(2026, 9, 4)).getDate()).toBe(28); // Sun 4 Oct -> Mon 28 Sep
  });

  it("formats week ranges across months and years", () => {
    expect(formatWeekRange(new Date(2026, 8, 28))).toBe("28 Sep – 4 Oct 2026");
    expect(formatWeekRange(new Date(2026, 9, 5))).toBe("5 – 11 Oct 2026");
    expect(formatWeekRange(new Date(2025, 11, 29))).toBe("29 Dec 2025 – 4 Jan 2026");
  });
});

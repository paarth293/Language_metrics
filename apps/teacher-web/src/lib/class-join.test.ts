import { describe, it, expect } from "vitest";
import { canJoin, getJoinState } from "./class-join";

const start = Date.parse("2026-09-29T22:10:00+05:30");
const end = Date.parse("2026-09-29T22:55:00+05:30");
const min = 60_000;

const session = (status = "SCHEDULED") => ({
  status,
  scheduledStart: new Date(start).toISOString(),
  scheduledEnd: new Date(end).toISOString(),
  joinOpensAt: new Date(start - 10 * min).toISOString(),
  joinClosesAt: new Date(end + 10 * min).toISOString(),
});

describe("getJoinState", () => {
  it("is joinable after the start time even though nobody has joined yet", () => {
    // The original bug: 5 minutes past start, status still SCHEDULED, no Join button.
    const state = getJoinState(session(), start + 5 * min);
    expect(state).toBe("open");
    expect(canJoin(state)).toBe(true);
  });

  it("opens exactly when the server's window opens", () => {
    expect(getJoinState(session(), start - 10 * min - 1)).toBe("soon");
    expect(getJoinState(session(), start - 10 * min)).toBe("open");
  });

  it("stays joinable through the grace period after the scheduled end", () => {
    expect(getJoinState(session(), end + 9 * min)).toBe("open");
    expect(getJoinState(session(), end + 11 * min)).toBe("closed");
  });

  it("reports a class with someone in the room as live", () => {
    expect(getJoinState(session("ONGOING"), start + 20 * min)).toBe("live");
  });

  it("never offers to join a finished or cancelled class", () => {
    expect(canJoin(getJoinState(session("COMPLETED"), start + 5 * min))).toBe(false);
    expect(canJoin(getJoinState(session("CANCELLED"), start + 5 * min))).toBe(false);
  });

  it("distinguishes soon from later", () => {
    expect(getJoinState(session(), start - 30 * min)).toBe("soon");
    expect(getJoinState(session(), start - 3 * 60 * min)).toBe("upcoming");
  });

  it("falls back to the default window when the server omits it", () => {
    const { joinOpensAt: _o, joinClosesAt: _c, ...bare } = session();
    expect(getJoinState(bare, start + 5 * min)).toBe("open");
    expect(getJoinState(bare, end + 11 * min)).toBe("closed");
  });
});

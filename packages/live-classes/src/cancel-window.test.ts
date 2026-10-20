import { afterEach, describe, expect, it, vi } from "vitest";
import {
  STUDENT_CANCEL_WINDOW_HOURS,
  STUDENT_CANCEL_WINDOW_MS,
  STUDENT_CANCEL_WINDOW_NOTE,
  canStudentCancel,
  studentCancelClosesAt,
  studentCancelRefusalMessage,
} from "./cancel-window";

/** Fixed reference instant. Every case below is built relative to this. */
const NOW = new Date("2026-10-20T12:00:00.000Z");
const HOUR = 60 * 60 * 1000;
/** `NOW` plus a number of hours, as the class start time. */
const startIn = (hours: number) => new Date(NOW.getTime() + hours * HOUR);

afterEach(() => {
  vi.useRealTimers();
});

describe("the window itself", () => {
  it("is four hours, in one place", () => {
    expect(STUDENT_CANCEL_WINDOW_HOURS).toBe(4);
    expect(STUDENT_CANCEL_WINDOW_MS).toBe(4 * HOUR);
  });

  it("builds its wording from the constant rather than repeating the number", () => {
    expect(STUDENT_CANCEL_WINDOW_NOTE).toBe(
      `Cancellation closes ${STUDENT_CANCEL_WINDOW_HOURS} hours before the class.`
    );
    expect(studentCancelRefusalMessage()).toContain(String(STUDENT_CANCEL_WINDOW_HOURS));
  });

  it("closes exactly four hours before the start", () => {
    expect(studentCancelClosesAt(startIn(10)).toISOString()).toBe("2026-10-20T18:00:00.000Z");
    expect(studentCancelClosesAt(startIn(4)).getTime()).toBe(NOW.getTime());
  });
});

describe("canStudentCancel", () => {
  it("allows a cancel five hours before the class", () => {
    expect(canStudentCancel(startIn(5), NOW)).toBe(true);
  });

  it("allows a cancel at exactly four hours", () => {
    expect(canStudentCancel(startIn(4), NOW)).toBe(true);
  });

  it("refuses a cancel at three hours fifty-nine minutes", () => {
    expect(canStudentCancel(new Date(NOW.getTime() + 3 * HOUR + 59 * 60_000), NOW)).toBe(false);
  });

  it("refuses one millisecond inside the window", () => {
    expect(canStudentCancel(new Date(NOW.getTime() + 4 * HOUR - 1), NOW)).toBe(false);
  });

  it("refuses a cancel at the start time", () => {
    expect(canStudentCancel(NOW, NOW)).toBe(false);
  });

  it("refuses a cancel after the class has started", () => {
    expect(canStudentCancel(startIn(-1), NOW)).toBe(false);
  });

  it("refuses a class far in the past", () => {
    expect(canStudentCancel(startIn(-240), NOW)).toBe(false);
  });

  it("compares absolute instants, so a zone offset cannot change the answer", () => {
    // 2026-10-20T16:00Z written three ways: exactly four hours after NOW.
    const utc = new Date("2026-10-20T16:00:00.000Z");
    const ist = new Date("2026-10-20T21:30:00+05:30");
    const pacific = new Date("2026-10-20T09:00:00-07:00");
    expect(ist.getTime()).toBe(utc.getTime());
    expect(pacific.getTime()).toBe(utc.getTime());
    for (const start of [utc, ist, pacific]) {
      expect(canStudentCancel(start, NOW)).toBe(true);
      // One millisecond later for `now` puts the same instant inside the window.
      expect(canStudentCancel(start, new Date(NOW.getTime() + 1))).toBe(false);
    }
  });

  it("fails closed on an unusable start time", () => {
    expect(canStudentCancel(new Date("not a date"), NOW)).toBe(false);
  });

  it("defaults to the current time when no clock is passed", () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    expect(canStudentCancel(startIn(5))).toBe(true);
    expect(canStudentCancel(startIn(3))).toBe(false);

    // Move the clock forward and the same class falls inside the window.
    vi.setSystemTime(new Date(NOW.getTime() + 2 * HOUR));
    expect(canStudentCancel(startIn(5))).toBe(false);
  });
});

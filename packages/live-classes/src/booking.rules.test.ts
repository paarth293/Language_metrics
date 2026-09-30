import { describe, expect, it } from "vitest";
import { classPrice, fitsAvailability, nextAvailableStart, normaliseDuration } from "./booking";

const weekdayMornings = [1, 2, 3, 4, 5].map((dayOfWeek) => ({ dayOfWeek, startTime: "09:00", endTime: "12:00" }));

describe("fitsAvailability", () => {
  it("reads slot times in the teacher's zone, not UTC", () => {
    // Monday 2026-10-05 09:00 IST == 03:30 UTC.
    const start = new Date("2026-10-05T03:30:00Z");
    expect(fitsAvailability(start, 60, weekdayMornings, "Asia/Kolkata")).toBe(true);
    expect(fitsAvailability(start, 60, weekdayMornings, "UTC")).toBe(false);
  });

  it("rejects a class that runs past the end of the slot", () => {
    const start = new Date("2026-10-05T05:30:00Z"); // 11:00 IST
    expect(fitsAvailability(start, 60, weekdayMornings, "Asia/Kolkata")).toBe(true);
    expect(fitsAvailability(start, 90, weekdayMornings, "Asia/Kolkata")).toBe(false);
  });

  it("uses the teacher's local day near midnight", () => {
    const lateSunday = [{ dayOfWeek: 0, startTime: "23:00", endTime: "23:59" }];
    // Sunday 2026-10-04 23:00 in New York == Monday 03:00 UTC.
    const start = new Date("2026-10-05T03:00:00Z");
    expect(fitsAvailability(start, 30, lateSunday, "America/New_York")).toBe(true);
  });
});

describe("nextAvailableStart", () => {
  it("returns the next slot start as a UTC instant", () => {
    // Saturday 2026-10-03 noon UTC; next weekday morning is Monday 09:00 IST.
    const from = new Date("2026-10-03T12:00:00Z");
    expect(nextAvailableStart(weekdayMornings, "Asia/Kolkata", 60, from)?.toISOString()).toBe(
      "2026-10-05T03:30:00.000Z"
    );
  });

  it("handles a DST offset change", () => {
    // New York leaves DST on 2026-11-01; Monday 09:00 EST == 14:00 UTC.
    const from = new Date("2026-10-31T12:00:00Z");
    expect(nextAvailableStart(weekdayMornings, "America/New_York", 60, from)?.toISOString()).toBe(
      "2026-11-02T14:00:00.000Z"
    );
  });

  it("skips slots too short for the class", () => {
    const from = new Date("2026-10-03T12:00:00Z");
    expect(nextAvailableStart(weekdayMornings, "Asia/Kolkata", 240, from)).toBeNull();
  });
});

describe("classPrice", () => {
  it("scales an hourly rate with duration", () => {
    expect(classPrice({ type: "HOURLY", amount: 600 }, 60)).toBe(600);
    expect(classPrice({ type: "HOURLY", amount: 600 }, 180)).toBe(1800);
    expect(classPrice({ type: "HOURLY", amount: 600 }, 30)).toBe(300);
  });

  it("keeps a course rate fixed", () => {
    expect(classPrice({ type: "COURSE", amount: 5000 }, 180)).toBe(5000);
  });
});

describe("normaliseDuration", () => {
  it("falls back to 60 for missing or out-of-range values", () => {
    expect(normaliseDuration(undefined, false)).toBe(60);
    expect(normaliseDuration(5, false)).toBe(60);
    expect(normaliseDuration(500, false)).toBe(60);
    expect(normaliseDuration("90", false)).toBe(60);
    expect(normaliseDuration(90, false)).toBe(90);
  });
});

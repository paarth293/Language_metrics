/**
 * Tests for the billing arithmetic.
 *
 * These are the tests that matter most in the whole integration: everything
 * else is plumbing that fails loudly, whereas a bug in here silently charges
 * the wrong person the wrong amount.
 *
 * Run: npx vitest run packages/livekit/src/metering.test.ts
 *  or: npx tsx --test packages/livekit/src/metering.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  computeBillableWindow,
  determineNoShow,
  intersectIntervals,
  mergeIntervals,
  settleSession,
  totalSeconds,
  type ParticipantPresence,
} from "./metering";

const T0 = Date.UTC(2026, 8, 20, 10, 0, 0);
const min = (n: number) => T0 + n * 60_000;

describe("mergeIntervals", () => {
  it("merges overlapping intervals", () => {
    const out = mergeIntervals([
      { start: min(0), end: min(10) },
      { start: min(5), end: min(15) },
    ]);
    assert.equal(out.length, 1);
    assert.equal(totalSeconds(out), 900);
  });

  it("merges touching intervals (a reconnect with no gap)", () => {
    const out = mergeIntervals([
      { start: min(0), end: min(10) },
      { start: min(10), end: min(20) },
    ]);
    assert.equal(out.length, 1);
    assert.equal(totalSeconds(out), 1200);
  });

  it("keeps genuinely separate intervals apart", () => {
    const out = mergeIntervals([
      { start: min(0), end: min(10) },
      { start: min(12), end: min(20) },
    ]);
    assert.equal(out.length, 2);
    assert.equal(totalSeconds(out), 1080);
  });

  it("discards zero-length and inverted intervals", () => {
    const out = mergeIntervals([
      { start: min(5), end: min(5) },
      { start: min(10), end: min(8) },
    ]);
    assert.deepEqual(out, []);
  });
});

describe("intersectIntervals", () => {
  it("returns only the overlap", () => {
    const out = intersectIntervals(
      [{ start: min(0), end: min(30) }],
      [{ start: min(10), end: min(40) }]
    );
    assert.equal(totalSeconds(out), 20 * 60);
  });

  it("returns nothing when there is no overlap", () => {
    const out = intersectIntervals(
      [{ start: min(0), end: min(10) }],
      [{ start: min(20), end: min(30) }]
    );
    assert.deepEqual(out, []);
  });

  it("handles many small overlaps against one long interval", () => {
    const out = intersectIntervals(
      [{ start: min(0), end: min(60) }],
      [
        { start: min(5), end: min(10) },
        { start: min(20), end: min(25) },
        { start: min(50), end: min(70) },
      ]
    );
    assert.equal(totalSeconds(out), (5 + 5 + 10) * 60);
  });
});

describe("computeBillableWindow", () => {
  const clampFrom = min(0);
  const clampTo = min(60);

  it("bills only the overlap when the teacher joins late", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(10), leftAt: min(60) },
      { userId: "s1", role: "STUDENT", joinedAt: min(0), leftAt: min(60) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(r.billableSeconds, 50 * 60);
    assert.equal(r.studentSeconds, 60 * 60);
    // The student waited 10 minutes alone and is not charged for it.
    assert.equal(r.studentSeconds - r.billableSeconds, 10 * 60);
  });

  it("survives a student reconnecting three times", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(0), leftAt: min(60) },
      { userId: "s1", role: "STUDENT", joinedAt: min(0), leftAt: min(10) },
      { userId: "s1", role: "STUDENT", joinedAt: min(12), leftAt: min(30) },
      { userId: "s1", role: "STUDENT", joinedAt: min(35), leftAt: min(60) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(r.billableSeconds, (10 + 18 + 25) * 60);
  });

  it("clamps an early join to the scheduled start", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(-10), leftAt: min(60) },
      { userId: "s1", role: "STUDENT", joinedAt: min(-8), leftAt: min(60) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(r.billableSeconds, 60 * 60, "pre-start minutes must not be billable");
  });

  it("clamps a still-connected participant to the ceiling", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(0), leftAt: null },
      { userId: "s1", role: "STUDENT", joinedAt: min(0), leftAt: null },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(r.billableSeconds, 60 * 60);
  });

  it("never bills one student for another student's presence", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(0), leftAt: min(60) },
      { userId: "s1", role: "STUDENT", joinedAt: min(0), leftAt: min(20) },
      { userId: "s2", role: "STUDENT", joinedAt: min(0), leftAt: min(60) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(r.billableSeconds, 20 * 60);
  });

  it("counts connection seconds across every body in the room", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(0), leftAt: min(60) },
      { userId: "s1", role: "STUDENT", joinedAt: min(0), leftAt: min(60) },
      { userId: "a1", role: "OBSERVER", joinedAt: min(0), leftAt: min(30) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    // What we are billed by LiveKit: 60 + 60 + 30 participant-minutes.
    assert.equal(r.connectionSeconds, 150 * 60);
    // What we bill the student: only their overlap with the teacher.
    assert.equal(r.billableSeconds, 60 * 60);
  });

  it("detects a teacher no-show", () => {
    const presences: ParticipantPresence[] = [
      { userId: "s1", role: "STUDENT", joinedAt: min(0), leftAt: min(15) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(r.billableSeconds, 0);
    assert.equal(determineNoShow(r), "TEACHER");
  });

  it("detects a student no-show", () => {
    const presences: ParticipantPresence[] = [
      { userId: "t1", role: "TEACHER", joinedAt: min(0), leftAt: min(20) },
    ];
    const r = computeBillableWindow({ presences, studentUserId: "s1", clampFrom, clampTo });
    assert.equal(determineNoShow(r), "STUDENT");
  });

  it("detects both parties absent", () => {
    const r = computeBillableWindow({
      presences: [],
      studentUserId: "s1",
      clampFrom,
      clampTo,
    });
    assert.equal(determineNoShow(r), "BOTH");
  });
});

describe("settleSession", () => {
  const base = { heldCoins: 60, coinsPerMinute: 1, noShow: "NONE" as const };

  it("charges the full hold for a full class", () => {
    const r = settleSession({ ...base, billableSeconds: 60 * 60 });
    assert.equal(r.chargedCoins, 60);
    assert.equal(r.refundedCoins, 0);
  });

  it("refunds the unused portion of a short class", () => {
    const r = settleSession({ ...base, billableSeconds: 25 * 60 });
    assert.equal(r.billableMinutes, 25);
    assert.equal(r.chargedCoins, 25);
    assert.equal(r.refundedCoins, 35);
  });

  it("rounds a partial minute up", () => {
    const r = settleSession({ ...base, billableSeconds: 25 * 60 + 1 });
    assert.equal(r.billableMinutes, 26);
  });

  it("applies the one-minute floor to a very short class", () => {
    const r = settleSession({ ...base, billableSeconds: 12 });
    assert.equal(r.billableMinutes, 1);
    assert.equal(r.chargedCoins, 1);
    assert.equal(r.refundedCoins, 59);
  });

  it("never charges beyond the hold when overage is off", () => {
    const r = settleSession({ ...base, billableSeconds: 90 * 60 });
    assert.equal(r.chargedCoins, 60, "student must never pay more than checkout showed");
    assert.equal(r.overageCoins, 0);
  });

  it("reports overage separately when overage is on", () => {
    const r = settleSession({ ...base, billableSeconds: 90 * 60, allowOverage: true });
    assert.equal(r.chargedCoins, 90);
    assert.equal(r.overageCoins, 30);
    assert.equal(r.refundedCoins, 0);
  });

  it("fully refunds and flags a teacher no-show", () => {
    const r = settleSession({ ...base, billableSeconds: 0, noShow: "TEACHER" });
    assert.equal(r.chargedCoins, 0);
    assert.equal(r.refundedCoins, 60);
    assert.equal(r.requiresReview, true);
  });

  it("charges the slot in full for a student no-show", () => {
    const r = settleSession({ ...base, billableSeconds: 0, noShow: "STUDENT" });
    assert.equal(r.chargedCoins, 60);
    assert.equal(r.refundedCoins, 0);
    assert.equal(r.requiresReview, false);
  });

  it("conserves coins: charged + refunded always equals the hold", () => {
    for (const seconds of [0, 1, 59, 60, 61, 1800, 3599, 3600, 7200]) {
      for (const noShow of ["NONE", "TEACHER", "STUDENT"] as const) {
        const r = settleSession({ ...base, billableSeconds: seconds, noShow });
        assert.equal(
          r.chargedCoins + r.refundedCoins,
          base.heldCoins,
          `coins leaked at ${seconds}s / ${noShow}`
        );
      }
    }
  });
});

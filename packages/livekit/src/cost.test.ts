/**
 * Cost model tests.
 *
 * These pin the arithmetic against LiveKit's published Build-tier rates
 * (verified 2026-09-20). If LiveKit changes a price, these fail first and
 * tell you exactly which number moved.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  BYTES_PER_GB,
  PRICING_TIERS,
  calculateMonthlyCost,
  downstreamGbPerHour,
  estimateSessionCost,
  evaluateBudget,
  profileForBudget,
  remainingFreeClassMinutes,
} from "./cost";
import { QUALITY_PROFILES } from "./config";

const build = PRICING_TIERS.build;
const close = (a: number, b: number, tol = 1e-9) =>
  assert.ok(Math.abs(a - b) < tol, `${a} !== ${b}`);

describe("downstreamGbPerHour", () => {
  it("matches the bitrate definition exactly", () => {
    const p = QUALITY_PROFILES.low;
    const expected = (((p.videoBitrate + p.audioBitrate) / 8) * 3600) / BYTES_PER_GB;
    close(downstreamGbPerHour(p), expected);
  });

  it("puts audio-only an order of magnitude below 360p video", () => {
    const audio = downstreamGbPerHour(QUALITY_PROFILES["audio-only"]);
    const low = downstreamGbPerHour(QUALITY_PROFILES.low);
    assert.ok(low / audio > 10, `expected >10x, got ${(low / audio).toFixed(1)}x`);
  });

  it("orders the profiles cheapest to dearest", () => {
    const order = (["audio-only", "low", "standard", "high"] as const).map((id) =>
      downstreamGbPerHour(QUALITY_PROFILES[id])
    );
    for (let i = 1; i < order.length; i++) {
      assert.ok(order[i]! > order[i - 1]!, "profiles must increase in cost");
    }
  });
});

describe("estimateSessionCost", () => {
  it("counts two connection minutes per class minute in a 1:1", () => {
    const e = estimateSessionCost({ durationMinutes: 60, participants: 2 });
    assert.equal(e.connectionMinutes, 120);
  });

  it("prices a 60-minute 1:1 at 360p as a fraction of a cent in connection fees", () => {
    const e = estimateSessionCost({ durationMinutes: 60, participants: 2, profile: "low" });
    close(e.connectionCostUsd, 120 * build.connectionMinuteUsd);
    assert.equal(e.connectionCostUsd.toFixed(3), "0.060");
  });

  it("charges zero marginal cost inside the free allowance", () => {
    const e = estimateSessionCost({ durationMinutes: 60, marginal: false });
    assert.equal(e.totalCostUsd, 0);
    // but the allowance is still consumed
    assert.equal(e.connectionMinutes, 120);
  });

  it("makes audio-only dramatically cheaper end to end", () => {
    const video = estimateSessionCost({ durationMinutes: 60, profile: "low" });
    const audio = estimateSessionCost({ durationMinutes: 60, profile: "audio-only" });
    assert.ok(audio.totalCostUsd < video.totalCostUsd);
    assert.ok(audio.bandwidthCostUsd < video.bandwidthCostUsd / 10);
  });

  it("prices audio recording at a quarter of video recording", () => {
    const v = estimateSessionCost({ durationMinutes: 60, recording: "video" });
    const a = estimateSessionCost({ durationMinutes: 60, recording: "audio" });
    close(v.egressCostUsd, 60 * 0.02);
    close(a.egressCostUsd, 60 * 0.005);
    close(v.egressCostUsd / a.egressCostUsd, 4);
  });

  it("scales downstream with receiving pairs, not with participants", () => {
    const two = estimateSessionCost({ durationMinutes: 60, participants: 2 });
    const four = estimateSessionCost({ durationMinutes: 60, participants: 4 });
    // 2 participants -> 2 receiving streams; 4 -> 12. Six times the traffic
    // for twice the people: this is why group classes need a hard cap.
    close(four.downstreamGb / two.downstreamGb, 6);
  });
});

describe("calculateMonthlyCost", () => {
  it("charges nothing while inside both allowances", () => {
    const c = calculateMonthlyCost({
      connectionMinutes: 4_000,
      downstreamGb: 20,
      egressVideoMinutes: 0,
      egressAudioMinutes: 0,
    });
    assert.equal(c.overageCostUsd, 0);
  });

  it("charges only the overage past an allowance", () => {
    const c = calculateMonthlyCost({
      connectionMinutes: 6_000,
      downstreamGb: 0,
      egressVideoMinutes: 0,
      egressAudioMinutes: 0,
    });
    assert.equal(c.billableConnectionMinutes, 1_000);
    close(c.connectionCostUsd, 1_000 * build.connectionMinuteUsd);
  });

  it("bills egress from the first minute — there is no egress allowance", () => {
    const c = calculateMonthlyCost({
      connectionMinutes: 0,
      downstreamGb: 0,
      egressVideoMinutes: 10,
      egressAudioMinutes: 0,
    });
    close(c.egressCostUsd, 0.2);
  });
});

describe("remainingFreeClassMinutes", () => {
  it("reports the free tier as ~41 hours of 1:1 teaching", () => {
    const left = remainingFreeClassMinutes({
      connectionMinutes: 0,
      downstreamGb: 0,
      egressVideoMinutes: 0,
      egressAudioMinutes: 0,
    });
    assert.equal(left, 2_500);
    assert.equal(Math.floor(left / 60), 41);
  });

  it("never goes negative once the allowance is blown", () => {
    const left = remainingFreeClassMinutes({
      connectionMinutes: 99_999,
      downstreamGb: 0,
      egressVideoMinutes: 0,
      egressAudioMinutes: 0,
    });
    assert.equal(left, 0);
  });
});

describe("evaluateBudget + profileForBudget", () => {
  const usage = (gb: number) => ({
    connectionMinutes: 0,
    downstreamGb: gb,
    egressVideoMinutes: 0,
    egressAudioMinutes: 0,
  });

  it("stays ok well inside budget", () => {
    assert.equal(evaluateBudget(usage(60), 25).verdict, "ok");
  });

  it("warns at 75%", () => {
    // 50GB free, then $0.12/GB. $18.75 = 75% of $25 -> 156.25GB billable.
    const b = evaluateBudget(usage(50 + 156.25), 25);
    assert.equal(b.verdict, "warn");
  });

  it("escalates to critical at 90% and exceeded at 100%", () => {
    assert.equal(evaluateBudget(usage(50 + 187.5), 25).verdict, "critical");
    assert.equal(evaluateBudget(usage(50 + 208.34), 25).verdict, "exceeded");
  });

  it("degrades quality as the budget fills", () => {
    assert.equal(profileForBudget("high", "ok"), "high");
    assert.equal(profileForBudget("high", "warn"), "low");
    assert.equal(profileForBudget("high", "critical"), "audio-only");
    assert.equal(profileForBudget("high", "exceeded"), "audio-only");
  });

  it("does not upgrade a profile the caller asked to keep low", () => {
    assert.equal(profileForBudget("audio-only", "ok"), "audio-only");
    assert.equal(profileForBudget("low", "warn"), "low");
  });
});

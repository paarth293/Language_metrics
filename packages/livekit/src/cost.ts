/**
 * @repo/livekit/cost — LiveKit Cloud cost model.
 *
 * Every rate below is from LiveKit's published price list (Build tier unless
 * stated). They are declared as data, not scattered through the code, so the
 * admin dashboard, the budget guard and the pre-flight estimator all agree.
 *
 * Verified against https://livekit.com/pricing on 2026-09-20.
 * If LiveKit changes its prices, change them here and nowhere else.
 */

import { QUALITY_PROFILES, type QualityProfile, type QualityProfileId } from "./config";

export const BYTES_PER_GB = 1024 ** 3;

export interface PricingTier {
  id: "build" | "ship" | "scale";
  label: string;
  monthlyMinimumUsd: number;
  includedConnectionMinutes: number;
  includedDownstreamGb: number;
  /** USD per connection minute beyond the included allowance. */
  connectionMinuteUsd: number;
  /** USD per downstream GB beyond the included allowance. */
  downstreamGbUsd: number;
  /** USD per minute of composite video egress (transcoded). */
  egressVideoMinuteUsd: number;
  /** USD per minute of composite audio-only egress (transcoded). */
  egressAudioMinuteUsd: number;
}

export const PRICING_TIERS: Record<PricingTier["id"], PricingTier> = {
  build: {
    id: "build",
    label: "Build (free)",
    monthlyMinimumUsd: 0,
    includedConnectionMinutes: 5_000,
    includedDownstreamGb: 50,
    connectionMinuteUsd: 0.0005,
    downstreamGbUsd: 0.12,
    egressVideoMinuteUsd: 0.02,
    egressAudioMinuteUsd: 0.005,
  },
  ship: {
    id: "ship",
    label: "Ship",
    monthlyMinimumUsd: 50,
    includedConnectionMinutes: 150_000,
    includedDownstreamGb: 500,
    connectionMinuteUsd: 0.0005,
    downstreamGbUsd: 0.12,
    egressVideoMinuteUsd: 0.02,
    egressAudioMinuteUsd: 0.005,
  },
  scale: {
    id: "scale",
    label: "Scale",
    monthlyMinimumUsd: 500,
    includedConnectionMinutes: 1_500_000,
    includedDownstreamGb: 3_072,
    connectionMinuteUsd: 0.0004,
    downstreamGbUsd: 0.10,
    egressVideoMinuteUsd: 0.015,
    egressAudioMinuteUsd: 0.004,
  },
};

export function activeTier(): PricingTier {
  const id = (process.env.LIVEKIT_PRICING_TIER ?? "build") as PricingTier["id"];
  return PRICING_TIERS[id] ?? PRICING_TIERS.build;
}

/**
 * Downstream GB the SFU sends to ONE receiving participant per hour at a
 * given profile.
 *
 * This is an upper bound. With simulcast + dynacast the SFU forwards only the
 * layer a receiver actually renders, so a student watching the teacher in a
 * small tile receives the 180p layer, not the 360p one. Budget with this
 * number, expect to spend less.
 */
export function downstreamGbPerHour(profile: QualityProfile): number {
  const bitsPerSecond = profile.videoBitrate + profile.audioBitrate;
  const bytesPerHour = (bitsPerSecond / 8) * 3600;
  return bytesPerHour / BYTES_PER_GB;
}

export interface SessionCostEstimate {
  /** Wall-clock length of the class. */
  durationMinutes: number;
  participants: number;
  profile: QualityProfileId;
  /** participants x durationMinutes — what LiveKit counts. */
  connectionMinutes: number;
  /** Upper-bound downstream traffic for the whole room. */
  downstreamGb: number;
  connectionCostUsd: number;
  bandwidthCostUsd: number;
  egressCostUsd: number;
  totalCostUsd: number;
}

export interface EstimateOptions {
  durationMinutes: number;
  participants?: number;
  profile?: QualityProfileId;
  recording?: "none" | "audio" | "video";
  tier?: PricingTier;
  /**
   * When true, prices at the marginal (post-allowance) rate. When false the
   * caller is inside the free allowance and the marginal cost is zero — but
   * the allowance itself is consumed, which is what `connectionMinutes` and
   * `downstreamGb` report.
   */
  marginal?: boolean;
}

/**
 * Cost of a single class session.
 *
 * `marginal: true` answers "what does one more class cost me once the free
 * tier is exhausted". `marginal: false` answers "what does this class cost me
 * right now", which inside the allowance is $0.
 */
export function estimateSessionCost(opts: EstimateOptions): SessionCostEstimate {
  const tier = opts.tier ?? activeTier();
  const participants = opts.participants ?? 2;
  const profileId = opts.profile ?? "low";
  const profile = QUALITY_PROFILES[profileId];
  const minutes = Math.max(0, opts.durationMinutes);

  const connectionMinutes = participants * minutes;

  // Each participant receives every OTHER participant's stream.
  const receivingStreams = participants * Math.max(0, participants - 1);
  const downstreamGb = downstreamGbPerHour(profile) * (minutes / 60) * receivingStreams;

  const marginal = opts.marginal ?? true;
  const connectionCostUsd = marginal ? connectionMinutes * tier.connectionMinuteUsd : 0;
  const bandwidthCostUsd = marginal ? downstreamGb * tier.downstreamGbUsd : 0;

  let egressCostUsd = 0;
  if (opts.recording === "video") egressCostUsd = minutes * tier.egressVideoMinuteUsd;
  else if (opts.recording === "audio") egressCostUsd = minutes * tier.egressAudioMinuteUsd;

  return {
    durationMinutes: minutes,
    participants,
    profile: profileId,
    connectionMinutes,
    downstreamGb,
    connectionCostUsd,
    bandwidthCostUsd,
    egressCostUsd,
    totalCostUsd: connectionCostUsd + bandwidthCostUsd + egressCostUsd,
  };
}

export interface MonthlyUsage {
  connectionMinutes: number;
  downstreamGb: number;
  egressVideoMinutes: number;
  egressAudioMinutes: number;
}

export interface MonthlyCostBreakdown {
  tier: PricingTier;
  usage: MonthlyUsage;
  /** Portion of each allowance consumed, 0..1+ */
  connectionMinutesUtilisation: number;
  downstreamGbUtilisation: number;
  billableConnectionMinutes: number;
  billableDownstreamGb: number;
  connectionCostUsd: number;
  bandwidthCostUsd: number;
  egressCostUsd: number;
  /** Excludes the plan's monthly minimum. */
  overageCostUsd: number;
  /** Includes the plan's monthly minimum. */
  totalCostUsd: number;
}

/** Month-to-date spend, allowances applied. Drives the admin dashboard. */
export function calculateMonthlyCost(
  usage: MonthlyUsage,
  tier: PricingTier = activeTier()
): MonthlyCostBreakdown {
  const billableConnectionMinutes = Math.max(
    0,
    usage.connectionMinutes - tier.includedConnectionMinutes
  );
  const billableDownstreamGb = Math.max(0, usage.downstreamGb - tier.includedDownstreamGb);

  const connectionCostUsd = billableConnectionMinutes * tier.connectionMinuteUsd;
  const bandwidthCostUsd = billableDownstreamGb * tier.downstreamGbUsd;
  const egressCostUsd =
    usage.egressVideoMinutes * tier.egressVideoMinuteUsd +
    usage.egressAudioMinutes * tier.egressAudioMinuteUsd;

  const overageCostUsd = connectionCostUsd + bandwidthCostUsd + egressCostUsd;

  return {
    tier,
    usage,
    connectionMinutesUtilisation:
      tier.includedConnectionMinutes > 0
        ? usage.connectionMinutes / tier.includedConnectionMinutes
        : 0,
    downstreamGbUtilisation:
      tier.includedDownstreamGb > 0 ? usage.downstreamGb / tier.includedDownstreamGb : 0,
    billableConnectionMinutes,
    billableDownstreamGb,
    connectionCostUsd,
    bandwidthCostUsd,
    egressCostUsd,
    overageCostUsd,
    totalCostUsd: overageCostUsd + tier.monthlyMinimumUsd,
  };
}

/**
 * How many more 1:1 class-minutes the current allowance covers.
 *
 * Reported to admins as "you have N hours of free classes left this month",
 * which is the only form of this number anybody actually acts on.
 */
export function remainingFreeClassMinutes(
  usage: MonthlyUsage,
  tier: PricingTier = activeTier(),
  participantsPerClass = 2
): number {
  const remaining = tier.includedConnectionMinutes - usage.connectionMinutes;
  if (remaining <= 0) return 0;
  return Math.floor(remaining / participantsPerClass);
}

export type BudgetVerdict = "ok" | "warn" | "critical" | "exceeded";

export interface BudgetStatus {
  verdict: BudgetVerdict;
  spendUsd: number;
  budgetUsd: number;
  utilisation: number;
  remainingFreeClassMinutes: number;
  message: string;
}

/**
 * Budget guard.
 *
 * `exceeded` is what the token route refuses on. Classes that are already in
 * progress are never cut off — the guard only blocks NEW rooms, because
 * dropping a student mid-lesson to save a fraction of a cent is a bad trade.
 */
export function evaluateBudget(
  usage: MonthlyUsage,
  budgetUsd: number,
  tier: PricingTier = activeTier()
): BudgetStatus {
  const breakdown = calculateMonthlyCost(usage, tier);
  const spendUsd = breakdown.overageCostUsd;
  const utilisation = budgetUsd > 0 ? spendUsd / budgetUsd : 0;
  const freeMinutes = remainingFreeClassMinutes(usage, tier);

  let verdict: BudgetVerdict = "ok";
  if (utilisation >= 1) verdict = "exceeded";
  else if (utilisation >= 0.9) verdict = "critical";
  else if (utilisation >= 0.75) verdict = "warn";

  const messages: Record<BudgetVerdict, string> = {
    ok: `$${spendUsd.toFixed(2)} of $${budgetUsd.toFixed(2)} used. About ${freeMinutes} free class-minutes left.`,
    warn: `$${spendUsd.toFixed(2)} of $${budgetUsd.toFixed(2)} used (75%+). Consider defaulting new classes to audio-only.`,
    critical: `$${spendUsd.toFixed(2)} of $${budgetUsd.toFixed(2)} used (90%+). New classes are being forced to audio-only.`,
    exceeded: `Monthly LiveKit budget of $${budgetUsd.toFixed(2)} exhausted. New rooms are blocked; in-progress classes continue.`,
  };

  return {
    verdict,
    spendUsd,
    budgetUsd,
    utilisation,
    remainingFreeClassMinutes: freeMinutes,
    message: messages[verdict],
  };
}

/**
 * Degrade quality automatically as the budget fills.
 *
 * This is the difference between a bill that plateaus and one that does not:
 * at 90% of budget every new class silently becomes audio-only, which costs
 * roughly 1/13th the bandwidth of 360p video and is still a perfectly good
 * language lesson.
 */
export function profileForBudget(
  requested: QualityProfileId,
  verdict: BudgetVerdict
): QualityProfileId {
  if (verdict === "exceeded" || verdict === "critical") return "audio-only";
  if (verdict === "warn" && (requested === "high" || requested === "standard")) return "low";
  return requested;
}

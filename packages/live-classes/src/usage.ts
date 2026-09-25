/**
 * Usage rollup and budget guard.
 *
 * Daily counters, upserted with atomic increments so concurrent webhooks do
 * not clobber each other. Feeds the admin cost dashboard and the guard that
 * degrades quality — or refuses new rooms — as the month's budget fills.
 */

import { db } from "@repo/database";
import {
  QUALITY_PROFILES,
  calculateMonthlyCost,
  downstreamGbPerHour,
  evaluateBudget,
  getLiveKitConfig,
  profileForBudget,
  remainingFreeClassMinutes,
  type BudgetStatus,
  type MonthlyCostBreakdown,
  type MonthlyUsage,
  type QualityProfileId,
} from "@repo/livekit";

export interface RecordUsageParams {
  day: string;
  connectionSeconds?: number;
  participantSessions?: number;
  egressVideoSeconds?: number;
  egressAudioSeconds?: number;
  classSessions?: number;
  /** When given, downstream bytes are estimated from that session's profile. */
  classSessionId?: string;
}

export async function recordDailyUsage(params: RecordUsageParams): Promise<void> {
  let downstreamBytes = BigInt(0);

  if (params.classSessionId && params.connectionSeconds) {
    const session = await db.classSession.findUnique({
      where: { id: params.classSessionId },
      select: { qualityProfile: true },
    });
    const profile =
      QUALITY_PROFILES[(session?.qualityProfile as QualityProfileId) ?? "low"] ??
      QUALITY_PROFILES.low;
    // Connection-seconds already counts every participant, and in a 1:1 each
    // participant receives exactly one remote stream, so seconds x per-stream
    // rate is the right estimate without needing the participant count.
    const gb = downstreamGbPerHour(profile) * (params.connectionSeconds / 3600);
    downstreamBytes = BigInt(Math.round(gb * 1024 ** 3));

    await db.classSession.update({
      where: { id: params.classSessionId },
      data: { downstreamBytes },
    });
  }

  // Atomic increments. Two webhooks finishing at the same instant both count.
  await db.$executeRaw`
    INSERT INTO "LiveKitUsageDaily"
      ("day", "connectionSeconds", "participantSessions", "egressVideoSeconds",
       "egressAudioSeconds", "downstreamBytes", "classSessions", "updatedAt")
    VALUES (${params.day},
            ${params.connectionSeconds ?? 0},
            ${params.participantSessions ?? 0},
            ${params.egressVideoSeconds ?? 0},
            ${params.egressAudioSeconds ?? 0},
            ${downstreamBytes},
            ${params.classSessions ?? 0},
            NOW())
    ON CONFLICT ("day") DO UPDATE SET
      "connectionSeconds"   = "LiveKitUsageDaily"."connectionSeconds"   + EXCLUDED."connectionSeconds",
      "participantSessions" = "LiveKitUsageDaily"."participantSessions" + EXCLUDED."participantSessions",
      "egressVideoSeconds"  = "LiveKitUsageDaily"."egressVideoSeconds"  + EXCLUDED."egressVideoSeconds",
      "egressAudioSeconds"  = "LiveKitUsageDaily"."egressAudioSeconds"  + EXCLUDED."egressAudioSeconds",
      "downstreamBytes"     = "LiveKitUsageDaily"."downstreamBytes"     + EXCLUDED."downstreamBytes",
      "classSessions"       = "LiveKitUsageDaily"."classSessions"       + EXCLUDED."classSessions",
      "updatedAt"           = NOW()
  `;
}

function monthBounds(reference = new Date()): { first: string; last: string } {
  const y = reference.getUTCFullYear();
  const m = reference.getUTCMonth();
  const first = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  const last = new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
  return { first, last };
}

export async function getMonthlyUsage(reference = new Date()): Promise<MonthlyUsage> {
  const { first, last } = monthBounds(reference);
  const rows = await db.liveKitUsageDaily.findMany({
    where: { day: { gte: first, lte: last } },
  });

  const totals = rows.reduce(
    (acc, r) => ({
      connectionSeconds: acc.connectionSeconds + r.connectionSeconds,
      downstreamBytes: acc.downstreamBytes + r.downstreamBytes,
      egressVideoSeconds: acc.egressVideoSeconds + r.egressVideoSeconds,
      egressAudioSeconds: acc.egressAudioSeconds + r.egressAudioSeconds,
    }),
    { connectionSeconds: 0, downstreamBytes: BigInt(0), egressVideoSeconds: 0, egressAudioSeconds: 0 }
  );

  return {
    connectionMinutes: totals.connectionSeconds / 60,
    downstreamGb: Number(totals.downstreamBytes) / 1024 ** 3,
    egressVideoMinutes: totals.egressVideoSeconds / 60,
    egressAudioMinutes: totals.egressAudioSeconds / 60,
  };
}

export interface LiveKitCostReport {
  usage: MonthlyUsage;
  breakdown: MonthlyCostBreakdown;
  budget: BudgetStatus;
  remainingFreeClassMinutes: number;
  daily: Array<{
    day: string;
    connectionMinutes: number;
    downstreamGb: number;
    classSessions: number;
    estimatedCostUsd: number;
  }>;
}

/** Everything the admin cost page renders, in one call. */
export async function getCostReport(reference = new Date()): Promise<LiveKitCostReport> {
  const config = getLiveKitConfig();
  const { first, last } = monthBounds(reference);

  const [usage, rows] = await Promise.all([
    getMonthlyUsage(reference),
    db.liveKitUsageDaily.findMany({
      where: { day: { gte: first, lte: last } },
      orderBy: { day: "asc" },
    }),
  ]);

  const breakdown = calculateMonthlyCost(usage);
  const budget = evaluateBudget(usage, config.monthlyBudgetUsd);

  // Daily cost is apportioned at the MARGINAL rate so the chart shows what an
  // extra day of this volume would cost, rather than showing $0 for every day
  // inside the allowance and then a cliff.
  const daily = rows.map((r) => {
    const connectionMinutes = r.connectionSeconds / 60;
    const downstreamGb = Number(r.downstreamBytes) / 1024 ** 3;
    return {
      day: r.day,
      connectionMinutes,
      downstreamGb,
      classSessions: r.classSessions,
      estimatedCostUsd:
        connectionMinutes * breakdown.tier.connectionMinuteUsd +
        downstreamGb * breakdown.tier.downstreamGbUsd +
        (r.egressVideoSeconds / 60) * breakdown.tier.egressVideoMinuteUsd +
        (r.egressAudioSeconds / 60) * breakdown.tier.egressAudioMinuteUsd,
    };
  });

  return {
    usage,
    breakdown,
    budget,
    remainingFreeClassMinutes: remainingFreeClassMinutes(usage),
    daily,
  };
}

export interface BudgetGate {
  allowed: boolean;
  profile: QualityProfileId;
  status: BudgetStatus;
}

/**
 * Called by the token route before every join.
 *
 * Returns the profile the participant is actually allowed, which may be lower
 * than the one they asked for. Two deliberate choices:
 *
 *   - Over budget blocks NEW joins but never kills a live room. Cutting a
 *     student off mid-lesson to save a fraction of a cent trades a real
 *     refund and a real complaint for an imaginary saving.
 *   - Teachers are never blocked. A teacher locked out of a class the student
 *     is already in is the worst possible failure, and it is the expensive
 *     one: it triggers a no-show refund of the entire booking.
 */
export async function checkBudgetGate(
  requestedProfile: QualityProfileId,
  opts: { isTeacher?: boolean; alreadyInRoom?: boolean } = {}
): Promise<BudgetGate> {
  const config = getLiveKitConfig();
  const usage = await getMonthlyUsage();
  const status = evaluateBudget(usage, config.monthlyBudgetUsd);
  const profile = profileForBudget(requestedProfile, status.verdict);

  const blocked =
    status.verdict === "exceeded" && !opts.isTeacher && !opts.alreadyInRoom;

  return { allowed: !blocked, profile, status };
}

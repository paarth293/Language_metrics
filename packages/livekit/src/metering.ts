/**
 * @repo/livekit/metering — pure billing arithmetic.
 *
 * No database, no SDK, no clock of its own. Everything here is a pure
 * function of intervals in, numbers out, so the money logic can be tested
 * exhaustively without standing up Postgres or LiveKit.
 *
 * The rule this file encodes
 * --------------------------
 * A student is billed for the time they and a teacher were BOTH connected.
 * Not for the slot they booked, not for the time they sat alone in an empty
 * room waiting, and not for the time the teacher was there without them.
 *
 * That rule is the product promise. It is also the only rule that survives
 * contact with reality: people's wifi drops, teachers join late, students
 * rejoin three times. Intersecting presence intervals handles all of it
 * without a single special case.
 */

export interface PresenceInterval {
  /** Inclusive start, epoch milliseconds. */
  start: number;
  /** Exclusive end, epoch milliseconds. */
  end: number;
}

export type ParticipantRole = "TEACHER" | "STUDENT" | "OBSERVER";

export interface ParticipantPresence {
  userId: string;
  role: ParticipantRole;
  joinedAt: number;
  /** null means still connected. */
  leftAt: number | null;
}

/** Sorts and merges overlapping/adjacent intervals into a canonical union. */
export function mergeIntervals(intervals: PresenceInterval[]): PresenceInterval[] {
  const valid = intervals
    .filter((i) => Number.isFinite(i.start) && Number.isFinite(i.end) && i.end > i.start)
    .sort((a, b) => a.start - b.start);

  const merged: PresenceInterval[] = [];
  for (const interval of valid) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end) {
      if (interval.end > last.end) last.end = interval.end;
    } else {
      merged.push({ start: interval.start, end: interval.end });
    }
  }
  return merged;
}

/** Intersection of two canonical unions. Linear two-pointer sweep. */
export function intersectIntervals(
  a: PresenceInterval[],
  b: PresenceInterval[]
): PresenceInterval[] {
  const left = mergeIntervals(a);
  const right = mergeIntervals(b);
  const out: PresenceInterval[] = [];

  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    const l = left[i]!;
    const r = right[j]!;
    const start = Math.max(l.start, r.start);
    const end = Math.min(l.end, r.end);
    if (end > start) out.push({ start, end });
    if (l.end < r.end) i++;
    else j++;
  }
  return out;
}

export function totalSeconds(intervals: PresenceInterval[]): number {
  return Math.round(
    intervals.reduce((acc, i) => acc + Math.max(0, i.end - i.start), 0) / 1000
  );
}

export interface BillableWindowInput {
  presences: ParticipantPresence[];
  /** The student being billed. */
  studentUserId: string;
  /**
   * Clamp for participants still connected (leftAt === null) and a hard
   * ceiling on the whole computation. Normally scheduledEnd + grace.
   */
  clampTo: number;
  /**
   * Nothing before this is billable, even if somebody joined early.
   * Normally scheduledStart.
   */
  clampFrom: number;
}

export interface BillableWindowResult {
  billableSeconds: number;
  intervals: PresenceInterval[];
  teacherSeconds: number;
  studentSeconds: number;
  /** Total participant-seconds — what LiveKit charges US for. */
  connectionSeconds: number;
  teacherPresent: boolean;
  studentPresent: boolean;
}

/**
 * Billable overlap between the student and any teacher.
 *
 * `connectionSeconds` is deliberately computed over ALL participants
 * including observers, because LiveKit bills us for every connected body
 * whether or not that body is billable to a student.
 */
export function computeBillableWindow(input: BillableWindowInput): BillableWindowResult {
  const { presences, studentUserId, clampFrom, clampTo } = input;

  const clamp = (p: ParticipantPresence): PresenceInterval => ({
    start: Math.max(p.joinedAt, clampFrom),
    end: Math.min(p.leftAt ?? clampTo, clampTo),
  });

  const teacherIntervals = mergeIntervals(
    presences.filter((p) => p.role === "TEACHER").map(clamp)
  );
  const studentIntervals = mergeIntervals(
    presences.filter((p) => p.role === "STUDENT" && p.userId === studentUserId).map(clamp)
  );

  const overlap = intersectIntervals(teacherIntervals, studentIntervals);

  // Connection seconds are NOT merged across participants: two people
  // connected for the same minute is two connection minutes to LiveKit.
  const connectionSeconds = presences.reduce((acc, p) => {
    const i = clamp(p);
    return acc + Math.max(0, i.end - i.start);
  }, 0);

  return {
    billableSeconds: totalSeconds(overlap),
    intervals: overlap,
    teacherSeconds: totalSeconds(teacherIntervals),
    studentSeconds: totalSeconds(studentIntervals),
    connectionSeconds: Math.round(connectionSeconds / 1000),
    teacherPresent: teacherIntervals.length > 0,
    studentPresent: studentIntervals.length > 0,
  };
}

export type NoShowParty = "NONE" | "TEACHER" | "STUDENT" | "BOTH";

export function determineNoShow(result: BillableWindowResult): NoShowParty {
  if (!result.teacherPresent && !result.studentPresent) return "BOTH";
  if (!result.teacherPresent) return "TEACHER";
  if (!result.studentPresent) return "STUDENT";
  return "NONE";
}

export interface SettlementInput {
  /** Coins reserved when the class was booked. */
  heldCoins: number;
  /** Coins per minute of class, from the teacher's rate. */
  coinsPerMinute: number;
  billableSeconds: number;
  noShow: NoShowParty;
  /**
   * Shortest chargeable class. A student who joins, says hello and leaves
   * after 40 seconds is billed one minute, not zero — the teacher showed up.
   */
  minimumBillableMinutes?: number;
  /**
   * Whether a class that overruns its slot may draw more coins than were
   * held. Off by default: a student can never be charged more than the
   * amount they saw at checkout.
   */
  allowOverage?: boolean;
}

export interface SettlementResult {
  billableMinutes: number;
  chargedCoins: number;
  refundedCoins: number;
  /** Extra coins needed beyond the hold. Zero unless allowOverage. */
  overageCoins: number;
  /** Teacher no-show, student fully refunded, needs an admin look. */
  requiresReview: boolean;
  reason: string;
}

/**
 * Turn a measured class into a coin movement.
 *
 * Rounding is UP to the minute and deliberately so — partial minutes are
 * rounded in the platform's favour, which is standard for metered billing and
 * is capped by the hold anyway, so the student is never surprised.
 */
export function settleSession(input: SettlementInput): SettlementResult {
  const {
    heldCoins,
    coinsPerMinute,
    billableSeconds,
    noShow,
    minimumBillableMinutes = 1,
    allowOverage = false,
  } = input;

  // Teacher never showed, or nobody did: the student pays nothing.
  if (noShow === "TEACHER" || noShow === "BOTH") {
    return {
      billableMinutes: 0,
      chargedCoins: 0,
      refundedCoins: heldCoins,
      overageCoins: 0,
      requiresReview: true,
      reason:
        noShow === "TEACHER"
          ? "Teacher did not join. Full refund issued; flagged for review."
          : "Neither party joined. Full refund issued; flagged for review.",
    };
  }

  // Student never showed. The teacher held the slot, so the hold is consumed.
  // This is the one case where "billable seconds" is not what we charge.
  if (noShow === "STUDENT") {
    return {
      billableMinutes: 0,
      chargedCoins: heldCoins,
      refundedCoins: 0,
      overageCoins: 0,
      requiresReview: false,
      reason: "Student did not join. Slot charged in full per the cancellation policy.",
    };
  }

  const rawMinutes = billableSeconds / 60;
  const billableMinutes =
    billableSeconds > 0
      ? Math.max(minimumBillableMinutes, Math.ceil(rawMinutes))
      : 0;

  const uncappedCharge = billableMinutes * coinsPerMinute;
  const chargedCoins = allowOverage ? uncappedCharge : Math.min(uncappedCharge, heldCoins);
  const overageCoins = allowOverage ? Math.max(0, uncappedCharge - heldCoins) : 0;
  const refundedCoins = Math.max(0, heldCoins - chargedCoins);

  return {
    billableMinutes,
    chargedCoins,
    refundedCoins,
    overageCoins,
    requiresReview: false,
    reason:
      refundedCoins > 0
        ? `Billed ${billableMinutes} min of the booked slot; ${refundedCoins} coins returned.`
        : `Billed ${billableMinutes} min.`,
  };
}

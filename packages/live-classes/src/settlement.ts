/**
 * Settlement — turn a finished class into a coin movement.
 *
 * Called from the room_finished webhook and from the reconciliation sweeper.
 * Safe to call twice: a session whose billing row is no longer HELD is left
 * alone and reported as already settled.
 */

import { captureHold, db, hold, releaseHold } from "@repo/database";
import {
  computeBillableWindow,
  determineNoShow,
  settleSession,
  type ParticipantPresence,
} from "@repo/livekit";
import { getLiveKitConfig } from "@repo/livekit";

export interface SettlementOutcome {
  classSessionId: string;
  alreadySettled: boolean;
  billableSeconds: number;
  billedMinutes: number;
  chargedCoins: number;
  refundedCoins: number;
  connectionSeconds: number;
  noShow: "NONE" | "TEACHER" | "STUDENT" | "BOTH";
  requiresReview: boolean;
  reason: string;
}

/**
 * Settle one class.
 *
 * The whole thing runs in a single transaction. Partial settlement — coins
 * moved but the session not marked settled, or vice versa — is the failure
 * mode that produces support tickets nobody can reconstruct, so it is made
 * structurally impossible rather than handled.
 */
export async function settleClassSession(
  classSessionId: string,
  opts: { endedAt?: Date; force?: boolean } = {}
): Promise<SettlementOutcome> {
  const config = getLiveKitConfig();

  return db.$transaction(async (tx) => {
    const session = await tx.classSession.findUnique({
      where: { id: classSessionId },
      include: { booking: true, billing: true, participants: true },
    });

    if (!session) throw new Error(`Class session ${classSessionId} not found.`);

    const billing = session.billing;

    if (billing && billing.status !== "HELD" && !opts.force) {
      return {
        classSessionId,
        alreadySettled: true,
        billableSeconds: session.billableSeconds,
        billedMinutes: billing.billedMinutes,
        chargedCoins: billing.chargedCoins,
        refundedCoins: billing.refundedCoins,
        connectionSeconds: session.connectionSeconds,
        noShow: session.noShow,
        requiresReview: billing.requiresReview,
        reason: billing.reason ?? "Already settled.",
      } satisfies SettlementOutcome;
    }

    const endedAt = opts.endedAt ?? new Date();
    const hardEnd = new Date(session.scheduledEnd.getTime() + config.graceMinutes * 60_000);
    // Never meter past the grace window even if the room somehow outlived it.
    const clampTo = Math.min(endedAt.getTime(), hardEnd.getTime());

    const presences: ParticipantPresence[] = session.participants.map((p) => ({
      userId: p.userId,
      role: p.role,
      joinedAt: p.joinedAt.getTime(),
      leftAt: p.leftAt ? p.leftAt.getTime() : null,
    }));

    const window = computeBillableWindow({
      presences,
      studentUserId: session.booking.studentId,
      clampFrom: session.scheduledStart.getTime(),
      clampTo,
    });
    const noShow = determineNoShow(window);

    const durationMinutes = Math.max(
      1,
      Math.round((session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60_000)
    );
    const heldCoins = billing?.heldCoins ?? session.booking.amountPaid;
    const coinsPerMinute =
      billing?.coinsPerMinute ?? Math.max(1, Math.round(heldCoins / durationMinutes));

    const result = settleSession({
      heldCoins,
      coinsPerMinute,
      billableSeconds: window.billableSeconds,
      noShow,
    });

    // Move the coins. captureHold is one statement, so the hold cannot be
    // partially consumed.
    if (heldCoins > 0) {
      await captureHold(
        {
          userId: session.booking.studentId,
          heldAmount: heldCoins,
          chargeAmount: result.chargedCoins,
          description: `Class on ${session.scheduledStart.toISOString().slice(0, 10)}`,
          idempotencyKey: `settle:${classSessionId}`,
          classSessionId,
          bookingId: session.bookingId,
        },
        tx
      );
    }

    await tx.classSession.update({
      where: { id: classSessionId },
      data: {
        status: "COMPLETED",
        actualEnd: new Date(clampTo),
        billableSeconds: window.billableSeconds,
        connectionSeconds: window.connectionSeconds,
        noShow,
      },
    });

    await tx.sessionBilling.upsert({
      where: { classSessionId },
      create: {
        classSessionId,
        studentId: session.booking.studentId,
        teacherId: session.booking.teacherId,
        heldCoins,
        coinsPerMinute,
        billedMinutes: result.billableMinutes,
        chargedCoins: result.chargedCoins,
        refundedCoins: result.refundedCoins,
        overageCoins: result.overageCoins,
        status: result.chargedCoins === 0 ? "REFUNDED" : "SETTLED",
        requiresReview: result.requiresReview,
        reason: result.reason,
        settledAt: new Date(),
      },
      update: {
        billedMinutes: result.billableMinutes,
        chargedCoins: result.chargedCoins,
        refundedCoins: result.refundedCoins,
        overageCoins: result.overageCoins,
        status: result.chargedCoins === 0 ? "REFUNDED" : "SETTLED",
        requiresReview: result.requiresReview,
        reason: result.reason,
        settledAt: new Date(),
      },
    });

    // Teacher earnings follow what the student was actually charged, not what
    // was booked. A 20-minute class does not earn a 60-minute fee.
    if (result.chargedCoins !== session.booking.amountPaid) {
      const commissionAmount = Math.round(
        (result.chargedCoins * session.booking.commissionPct) / 100
      );
      await tx.booking.update({
        where: { id: session.bookingId },
        data: {
          status: "COMPLETED",
          amountPaid: result.chargedCoins,
          commissionAmount,
          teacherEarnings: result.chargedCoins - commissionAmount,
        },
      });
    } else {
      await tx.booking.update({
        where: { id: session.bookingId },
        data: { status: "COMPLETED" },
      });
    }

    if (result.requiresReview) {
      await tx.notification.create({
        data: {
          userId: session.booking.studentId,
          type: "BOOKING_UPDATE",
          title: "Class refunded",
          message: result.reason,
        },
      });
    }

    return {
      classSessionId,
      alreadySettled: false,
      billableSeconds: window.billableSeconds,
      billedMinutes: result.billableMinutes,
      chargedCoins: result.chargedCoins,
      refundedCoins: result.refundedCoins,
      connectionSeconds: window.connectionSeconds,
      noShow,
      requiresReview: result.requiresReview,
      reason: result.reason,
    } satisfies SettlementOutcome;
  });
}

/**
 * Reserve coins for a class at booking time.
 *
 * Call this instead of writing a SPEND row when a class is booked. The
 * student is not charged yet — nothing is spent until minutes are measured.
 */
export async function holdCoinsForSession(params: {
  classSessionId: string;
  studentId: string;
  teacherId: string;
  heldCoins: number;
  durationMinutes: number;
}): Promise<void> {
  const coinsPerMinute = Math.max(1, Math.round(params.heldCoins / params.durationMinutes));

  await db.$transaction(async (tx) => {
    await hold(
      {
        userId: params.studentId,
        amount: params.heldCoins,
        description: "Class booked — coins reserved until the class is measured",
        idempotencyKey: `hold:${params.classSessionId}`,
        classSessionId: params.classSessionId,
      },
      tx
    );

    await tx.sessionBilling.upsert({
      where: { classSessionId: params.classSessionId },
      create: {
        classSessionId: params.classSessionId,
        studentId: params.studentId,
        teacherId: params.teacherId,
        heldCoins: params.heldCoins,
        coinsPerMinute,
        status: "HELD",
      },
      update: {},
    });
  });
}

/** Cancel before the class: the hold goes straight back, nothing is charged. */
export async function refundSessionHold(
  classSessionId: string,
  reason: string
): Promise<void> {
  await db.$transaction(async (tx) => {
    const billing = await tx.sessionBilling.findUnique({ where: { classSessionId } });
    if (!billing || billing.status !== "HELD") return;

    await releaseHold(
      {
        userId: billing.studentId,
        amount: billing.heldCoins,
        description: reason,
        idempotencyKey: `refund:${classSessionId}`,
        classSessionId,
      },
      tx
    );

    await tx.sessionBilling.update({
      where: { classSessionId },
      data: {
        status: "REFUNDED",
        refundedCoins: billing.heldCoins,
        reason,
        settledAt: new Date(),
      },
    });
  });
}

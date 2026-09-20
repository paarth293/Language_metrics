/**
 * Join eligibility — the one place that decides who may enter a class room.
 *
 * Every dashboard (student web, teacher web, mobile, admin) routes through
 * this. The previous code had this logic duplicated in two token routes that
 * had already drifted apart: one enforced a 5-minute join window, the other
 * enforced none at all.
 *
 * This is a cost control as much as a security control. Every minute someone
 * is connected is a minute LiveKit bills us for, so "can this person be in
 * this room right now" is literally a spending decision.
 */

import { db } from "@repo/database";
import { getLiveKitConfig, type QualityProfileId } from "@repo/livekit";
import type { ClassRole } from "@repo/livekit/server";

export type JoinDenialCode =
  | "SESSION_NOT_FOUND"
  | "NOT_A_PARTICIPANT"
  | "SESSION_CANCELLED"
  | "SESSION_COMPLETED"
  | "TOO_EARLY"
  | "TOO_LATE"
  | "BOOKING_NOT_CONFIRMED"
  | "BUDGET_EXCEEDED";

export interface JoinDenial {
  ok: false;
  code: JoinDenialCode;
  message: string;
  /** Present for TOO_EARLY so the client can show a countdown. */
  joinOpensAt?: string;
  httpStatus: number;
}

export interface JoinGrant {
  ok: true;
  classSessionId: string;
  bookingId: string;
  role: ClassRole;
  userId: string;
  displayName: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  /** Latest moment a token is allowed to remain valid. */
  hardEndsAt: Date;
  ttlSeconds: number;
  /** Counterparty's display name, for the waiting-room copy. */
  otherPartyName: string;
  coinsPerMinute: number;
  heldCoins: number;
  recordingRequested: boolean;
  profile: QualityProfileId;
}

export type JoinDecision = JoinGrant | JoinDenial;

function deny(
  code: JoinDenialCode,
  message: string,
  httpStatus: number,
  extra: Partial<JoinDenial> = {}
): JoinDenial {
  return { ok: false, code, message, httpStatus, ...extra };
}

export interface EvaluateJoinParams {
  classSessionId: string;
  userId: string;
  role: ClassRole;
  requestedProfile?: QualityProfileId;
  now?: Date;
}

/**
 * Decide whether a user may join, and on what terms.
 *
 * Pure-ish: one database read, no writes, no side effects. Callers that want
 * to mint a token call this first and mint only on `ok: true`.
 */
export async function evaluateJoin(params: EvaluateJoinParams): Promise<JoinDecision> {
  const config = getLiveKitConfig();
  const now = params.now ?? new Date();

  const session = await db.classSession.findUnique({
    where: { id: params.classSessionId },
    include: {
      booking: {
        include: {
          student: { select: { userId: true, name: true } },
          teacher: { select: { userId: true, name: true } },
        },
      },
      billing: true,
    },
  });

  if (!session) {
    return deny("SESSION_NOT_FOUND", "This class could not be found.", 404);
  }

  const { booking } = session;
  const isStudent = booking.studentId === params.userId;
  const isTeacher = booking.teacherId === params.userId;
  const isAdmin = params.role === "ADMIN";

  if (!isStudent && !isTeacher && !isAdmin) {
    return deny("NOT_A_PARTICIPANT", "You are not a participant in this class.", 403);
  }

  // Trust the booking, not the caller's claimed role. A student presenting
  // role=TEACHER would otherwise receive moderator grants.
  const effectiveRole: ClassRole = isAdmin ? "ADMIN" : isTeacher ? "TEACHER" : "STUDENT";

  if (session.status === "CANCELLED" || booking.status === "CANCELLED") {
    return deny("SESSION_CANCELLED", "This class was cancelled.", 410);
  }
  if (session.status === "COMPLETED") {
    return deny("SESSION_COMPLETED", "This class has already finished.", 410);
  }
  if (booking.status === "PENDING") {
    return deny("BOOKING_NOT_CONFIRMED", "This booking is not confirmed yet.", 409);
  }

  const joinOpensAt = new Date(
    session.scheduledStart.getTime() - config.joinWindowMinutes * 60_000
  );
  const hardEndsAt = new Date(session.scheduledEnd.getTime() + config.graceMinutes * 60_000);

  // Admins observe at any time; they are `hidden` participants and the
  // monitoring case is exactly the case where the window is inconvenient.
  if (!isAdmin) {
    if (now < joinOpensAt) {
      return deny(
        "TOO_EARLY",
        `This class opens ${config.joinWindowMinutes} minutes before it starts.`,
        403,
        { joinOpensAt: joinOpensAt.toISOString() }
      );
    }
    if (now > hardEndsAt) {
      return deny("TOO_LATE", "The join window for this class has closed.", 410);
    }
  }

  const durationMinutes = Math.max(
    1,
    Math.round((session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60_000)
  );
  const heldCoins = session.billing?.heldCoins ?? booking.amountPaid;
  const coinsPerMinute =
    session.billing?.coinsPerMinute ?? Math.max(1, Math.round(heldCoins / durationMinutes));

  // TTL never outlives the class. A tab left open overnight cannot silently
  // reconnect and bill us; the token simply stops working.
  const ttlSeconds = Math.max(300, Math.ceil((hardEndsAt.getTime() - now.getTime()) / 1000));

  return {
    ok: true,
    classSessionId: session.id,
    bookingId: booking.id,
    role: effectiveRole,
    userId: params.userId,
    displayName:
      effectiveRole === "TEACHER"
        ? booking.teacher.name
        : effectiveRole === "STUDENT"
          ? booking.student.name
          : "Moderator",
    scheduledStart: session.scheduledStart,
    scheduledEnd: session.scheduledEnd,
    hardEndsAt,
    ttlSeconds,
    otherPartyName: effectiveRole === "TEACHER" ? booking.student.name : booking.teacher.name,
    coinsPerMinute,
    heldCoins,
    recordingRequested: session.isRecordingPaid,
    profile: params.requestedProfile ?? (session.qualityProfile as QualityProfileId) ?? "low",
  };
}

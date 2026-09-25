/**
 * Framework-agnostic request handlers.
 *
 * Each returns `{ status, body }`. The Next.js route files in student-web,
 * teacher-web and admin-panel authenticate the caller and then delegate here,
 * so all four surfaces share one implementation of every rule.
 *
 * This exists specifically because the codebase previously had two token
 * endpoints — `/api/students/classes/[id]/livekit-token` and
 * `/api/teachers/session/token` — which had drifted: one enforced a join
 * window, the other did not; one returned `{token, roomName, wsUrl}`, the
 * other `{token, wsUrl, roomName, configured}`; and both returned strings
 * that were not LiveKit tokens at all. One handler, one contract.
 */

import { db } from "@repo/database";
import {
  QUALITY_PROFILES,
  isLiveKitConfigured,
  settleSession,
  computeBillableWindow,
  determineNoShow,
  type ParticipantPresence,
  type QualityProfileId,
} from "@repo/livekit";
import { endClassRoom, ensureClassRoom, mintClassToken } from "@repo/livekit/server";

import { evaluateJoin } from "./access";
import { checkBudgetGate } from "./usage";
import { settleClassSession } from "./settlement";
import { startRecording, stopRecording } from "./recording";

export interface HandlerResponse<T = unknown> {
  status: number;
  body: T;
}

export interface AuthedUser {
  userId: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
}

function isValidProfile(value: unknown): value is QualityProfileId {
  return typeof value === "string" && value in QUALITY_PROFILES;
}

/**
 * POST /api/live/token
 *
 * The single entry point to a class room, for every role and every client.
 */
export async function handleTokenRequest(
  user: AuthedUser,
  input: { classSessionId?: unknown; profile?: unknown }
): Promise<HandlerResponse> {
  if (typeof input.classSessionId !== "string" || input.classSessionId.length === 0) {
    return {
      status: 400,
      body: { code: "SESSION_NOT_FOUND", message: "classSessionId is required." },
    };
  }

  if (!isLiveKitConfigured()) {
    // Explicit and loud. The old code silently handed out `mock_token_...`
    // strings, so a misconfigured production deploy looked healthy right up
    // until every student failed to connect with an opaque LiveKit error.
    return {
      status: 503,
      body: {
        code: "NOT_CONFIGURED",
        message:
          "Live classes are not configured on this server. Set LIVEKIT_API_KEY, " +
          "LIVEKIT_API_SECRET and LIVEKIT_WS_URL.",
      },
    };
  }

  const decision = await evaluateJoin({
    classSessionId: input.classSessionId,
    userId: user.userId,
    role: user.role,
    requestedProfile: isValidProfile(input.profile) ? input.profile : undefined,
  });

  if (!decision.ok) {
    return {
      status: decision.httpStatus,
      body: {
        code: decision.code,
        message: decision.message,
        ...(decision.joinOpensAt ? { joinOpensAt: decision.joinOpensAt } : {}),
      },
    };
  }

  const gate = await checkBudgetGate(decision.profile, {
    isTeacher: decision.role === "TEACHER" || decision.role === "ADMIN",
  });

  if (!gate.allowed) {
    return {
      status: 503,
      body: { code: "BUDGET_EXCEEDED", message: gate.status.message },
    };
  }

  // Create the room before handing out a token so its emptyTimeout and
  // maxParticipants are ours rather than LiveKit's defaults. A room
  // auto-created by the first join ignores both.
  await ensureClassRoom({ classSessionId: decision.classSessionId });

  const minted = await mintClassToken({
    classSessionId: decision.classSessionId,
    bookingId: decision.bookingId,
    userId: decision.userId,
    displayName: decision.displayName,
    role: decision.role,
    profile: gate.profile,
    ttlSeconds: decision.ttlSeconds,
  });

  // Remember what we granted so the bandwidth estimator is not guessing.
  await db.classSession.update({
    where: { id: decision.classSessionId },
    data: { qualityProfile: gate.profile, lkRoomName: minted.roomName },
  });

  return {
    status: 200,
    body: {
      ...minted,
      role: decision.role,
      profile: gate.profile,
      otherPartyName: decision.otherPartyName,
      scheduledStart: decision.scheduledStart.toISOString(),
      scheduledEnd: decision.scheduledEnd.toISOString(),
      hardEndsAt: decision.hardEndsAt.toISOString(),
      coinsPerMinute: decision.coinsPerMinute,
      heldCoins: decision.heldCoins,
      recordingEnabled: decision.recordingRequested,
    },
  };
}

/**
 * GET /api/live/[classSessionId]/status
 *
 * Powers the waiting room. Read from our own tables rather than LiveKit's
 * API: this endpoint is polled, and polling LiveKit's REST API every few
 * seconds per waiting student is both slow and rate-limited.
 */
export async function handleSessionStatus(
  user: AuthedUser,
  classSessionId: string
): Promise<HandlerResponse> {
  const session = await db.classSession.findUnique({
    where: { id: classSessionId },
    include: {
      booking: { select: { studentId: true, teacherId: true } },
      participants: { where: { leftAt: null } },
    },
  });

  if (!session) return { status: 404, body: { message: "Class not found." } };

  const isParticipant =
    session.booking.studentId === user.userId || session.booking.teacherId === user.userId;
  if (!isParticipant && user.role !== "ADMIN") {
    return { status: 403, body: { message: "You are not a participant in this class." } };
  }

  return {
    status: 200,
    body: {
      classSessionId,
      roomActive: session.participants.length > 0,
      numParticipants: session.participants.length,
      teacherPresent: session.participants.some((p) => p.role === "TEACHER"),
      studentPresent: session.participants.some((p) => p.role === "STUDENT"),
      status: session.status,
      scheduledStart: session.scheduledStart.toISOString(),
      scheduledEnd: session.scheduledEnd.toISOString(),
      recordingStatus: session.recordingStatus,
    },
  };
}

/**
 * GET /api/live/[classSessionId]/meter
 *
 * The running total the student sees during class.
 *
 * Computed with exactly the same functions settlement uses, so the number on
 * screen at minute 25 is the number they are charged if they leave at minute
 * 25. A meter that disagrees with the invoice is worse than no meter.
 */
export async function handleMeter(
  user: AuthedUser,
  classSessionId: string
): Promise<HandlerResponse> {
  const session = await db.classSession.findUnique({
    where: { id: classSessionId },
    include: { booking: true, billing: true, participants: true },
  });

  if (!session) return { status: 404, body: { message: "Class not found." } };

  const isParticipant =
    session.booking.studentId === user.userId || session.booking.teacherId === user.userId;
  if (!isParticipant && user.role !== "ADMIN") {
    return { status: 403, body: { message: "You are not a participant in this class." } };
  }

  const settled = session.billing?.status && session.billing.status !== "HELD";

  if (settled && session.billing) {
    return {
      status: 200,
      body: {
        classSessionId,
        billableSeconds: session.billableSeconds,
        billableMinutes: session.billing.billedMinutes,
        coinsPerMinute: session.billing.coinsPerMinute,
        coinsSoFar: session.billing.chargedCoins,
        heldCoins: session.billing.heldCoins,
        projectedRefund: session.billing.refundedCoins,
        settled: true,
      },
    };
  }

  const durationMinutes = Math.max(
    1,
    Math.round((session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60_000)
  );
  const heldCoins = session.billing?.heldCoins ?? session.booking.amountPaid;
  const coinsPerMinute =
    session.billing?.coinsPerMinute ?? Math.max(1, Math.round(heldCoins / durationMinutes));

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
    clampTo: Date.now(),
  });

  const projection = settleSession({
    heldCoins,
    coinsPerMinute,
    billableSeconds: window.billableSeconds,
    noShow: determineNoShow(window),
  });

  return {
    status: 200,
    body: {
      classSessionId,
      billableSeconds: window.billableSeconds,
      billableMinutes: projection.billableMinutes,
      coinsPerMinute,
      coinsSoFar: projection.chargedCoins,
      heldCoins,
      projectedRefund: projection.refundedCoins,
      settled: false,
    },
  };
}

/**
 * POST /api/live/[classSessionId]/end
 *
 * Teacher ends the class. Closing the LiveKit room disconnects everyone,
 * which stops connection minutes accruing immediately — the cheapest possible
 * moment to end a class is the moment the teaching stops.
 */
export async function handleEndClass(
  user: AuthedUser,
  classSessionId: string
): Promise<HandlerResponse> {
  const session = await db.classSession.findUnique({
    where: { id: classSessionId },
    include: { booking: { select: { teacherId: true } } },
  });

  if (!session) return { status: 404, body: { message: "Class not found." } };
  if (user.role !== "ADMIN" && session.booking.teacherId !== user.userId) {
    return { status: 403, body: { message: "Only the teacher can end this class." } };
  }

  await stopRecording(classSessionId).catch(() => {});
  await endClassRoom(classSessionId);

  // Settle immediately rather than waiting for the room_finished webhook.
  // It is idempotent, so the webhook arriving afterwards is a no-op, and the
  // teacher sees a finished class instead of a spinner.
  const outcome = await settleClassSession(classSessionId, { endedAt: new Date() });

  return { status: 200, body: outcome };
}

/** POST /api/live/[classSessionId]/recording */
export async function handleStartRecording(
  user: AuthedUser,
  classSessionId: string,
  mode: "audio" | "video"
): Promise<HandlerResponse> {
  if (user.role === "STUDENT") {
    return { status: 403, body: { message: "Only the teacher can start a recording." } };
  }
  const result = await startRecording({
    classSessionId,
    requestedBy: user.userId,
    role: user.role,
    mode,
  });
  if (!result.ok) {
    return { status: result.httpStatus, body: { code: result.code, message: result.message } };
  }
  return { status: 200, body: result };
}

/** DELETE /api/live/[classSessionId]/recording */
export async function handleStopRecording(
  user: AuthedUser,
  classSessionId: string
): Promise<HandlerResponse> {
  if (user.role === "STUDENT") {
    return { status: 403, body: { message: "Only the teacher can stop a recording." } };
  }
  await stopRecording(classSessionId);
  return { status: 200, body: { stopped: true } };
}

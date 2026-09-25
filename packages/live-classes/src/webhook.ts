/**
 * LiveKit webhook handler.
 *
 * This is the component that makes per-minute billing real. Without it the
 * server never learns when anybody actually joined or left, `actualStart` and
 * `actualEnd` stay null forever, and "metered billing" is just a booking fee
 * with extra steps.
 *
 * Three properties it must have, because LiveKit's delivery guarantees are
 * at-least-once and unordered:
 *
 *   1. Idempotent. The same event WILL arrive twice. Every handler is keyed
 *      on something stable (participant sid, egress id, session id) and the
 *      WebhookEvent table rejects duplicates at the unique index.
 *   2. Order-independent. `room_finished` can land before the last
 *      `participant_left`. Rather than assuming order, room_finished closes
 *      any participant row still open, so a missing or late `left` event
 *      cannot inflate a bill.
 *   3. Fail-closed on money, fail-open on telemetry. If settlement throws,
 *      the event is recorded as failed and retried. If a usage rollup throws,
 *      it is swallowed — a cost graph is not worth failing a webhook over.
 */

import { db } from "@repo/database";
import {
  getLiveKitConfig,
  roomNameForSession,
  sessionIdFromRoomName,
} from "@repo/livekit";
import { parseParticipantMetadata, type WebhookEvent } from "@repo/livekit/server";

import { settleClassSession } from "./settlement";
import { recordDailyUsage } from "./usage";

export interface WebhookResult {
  handled: boolean;
  duplicate: boolean;
  event: string;
  classSessionId?: string;
  detail?: string;
}

/** LiveKit timestamps are seconds, sometimes as bigint. Normalise to ms. */
function toDate(value: number | bigint | undefined, fallback: Date): Date {
  if (value === undefined || value === null) return fallback;
  const seconds = typeof value === "bigint" ? Number(value) : value;
  if (!Number.isFinite(seconds) || seconds <= 0) return fallback;
  return new Date(seconds * 1000);
}

/**
 * Process one verified webhook event.
 *
 * `rawEvent` must already have passed signature verification — see
 * `verifyWebhook` in @repo/livekit/server. This function assumes authenticity
 * and concerns itself only with meaning.
 */
export async function handleLiveKitWebhook(rawEvent: WebhookEvent): Promise<WebhookResult> {
  const eventType = rawEvent.event;
  const eventId = rawEvent.id || `${eventType}:${rawEvent.createdAt}`;
  const occurredAt = toDate(rawEvent.createdAt, new Date());

  // Claim the event. A concurrent duplicate loses here, at the unique index.
  try {
    await db.webhookEvent.create({
      data: { source: "livekit", eventId, eventType },
    });
  } catch {
    return { handled: false, duplicate: true, event: eventType };
  }

  try {
    const result = await dispatch(rawEvent, occurredAt);
    await db.webhookEvent.update({
      where: { source_eventId: { source: "livekit", eventId } },
      data: { processedAt: new Date() },
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.webhookEvent.update({
      where: { source_eventId: { source: "livekit", eventId } },
      data: { error: message.slice(0, 500) },
    });
    // Rethrow so the route returns 5xx and LiveKit retries. The row stays
    // with processedAt null and error set, which is the retry signal.
    throw err;
  }
}

async function dispatch(event: WebhookEvent, occurredAt: Date): Promise<WebhookResult> {
  switch (event.event) {
    case "room_started":
      return onRoomStarted(event, occurredAt);
    case "participant_joined":
      return onParticipantJoined(event, occurredAt);
    case "participant_left":
      return onParticipantLeft(event, occurredAt);
    case "room_finished":
      return onRoomFinished(event, occurredAt);
    case "egress_started":
    case "egress_updated":
      return onEgressProgress(event);
    case "egress_ended":
      return onEgressEnded(event);
    default:
      return { handled: false, duplicate: false, event: event.event };
  }
}

function sessionIdFor(event: WebhookEvent): string | null {
  const roomName = event.room?.name ?? event.egressInfo?.roomName;
  return roomName ? sessionIdFromRoomName(roomName) : null;
}

async function onRoomStarted(event: WebhookEvent, occurredAt: Date): Promise<WebhookResult> {
  const classSessionId = sessionIdFor(event);
  if (!classSessionId) return { handled: false, duplicate: false, event: event.event };

  const session = await db.classSession.findUnique({ where: { id: classSessionId } });
  if (!session) {
    return {
      handled: false,
      duplicate: false,
      event: event.event,
      detail: "Room does not map to a known class session.",
    };
  }

  await db.classSession.update({
    where: { id: classSessionId },
    data: {
      lkRoomName: event.room?.name ?? roomNameForSession(classSessionId),
      lkRoomSid: event.room?.sid ?? null,
      // actualStart is the first time a room opened, not the latest. A room
      // that empties and reopens must not reset the class's start time.
      actualStart: session.actualStart ?? occurredAt,
      status: session.status === "SCHEDULED" ? "ONGOING" : session.status,
    },
  });

  return { handled: true, duplicate: false, event: event.event, classSessionId };
}

async function onParticipantJoined(
  event: WebhookEvent,
  occurredAt: Date
): Promise<WebhookResult> {
  const classSessionId = sessionIdFor(event);
  const participant = event.participant;
  if (!classSessionId || !participant) {
    return { handled: false, duplicate: false, event: event.event };
  }

  const metadata = parseParticipantMetadata(participant.metadata);
  const session = await db.classSession.findUnique({
    where: { id: classSessionId },
    include: { booking: { select: { studentId: true, teacherId: true } } },
  });
  if (!session) return { handled: false, duplicate: false, event: event.event };

  const userId = metadata?.userId ?? participant.identity;

  // Derive the role from the booking, not from metadata. Metadata is signed
  // into the token so it is trustworthy, but the booking is authoritative and
  // costs one field on a row we already loaded.
  const role =
    userId === session.booking.teacherId
      ? "TEACHER"
      : userId === session.booking.studentId
        ? "STUDENT"
        : "OBSERVER";

  const joinedAt = toDate(participant.joinedAt, occurredAt);

  // participantSid is unique per connection, so a replayed join is a no-op.
  await db.liveParticipantSession.upsert({
    where: { participantSid: participant.sid },
    create: {
      classSessionId,
      userId,
      role,
      identity: participant.identity,
      participantSid: participant.sid,
      joinedAt,
    },
    update: {},
  });

  return { handled: true, duplicate: false, event: event.event, classSessionId };
}

async function onParticipantLeft(event: WebhookEvent, occurredAt: Date): Promise<WebhookResult> {
  const classSessionId = sessionIdFor(event);
  const participant = event.participant;
  if (!classSessionId || !participant) {
    return { handled: false, duplicate: false, event: event.event };
  }

  const row = await db.liveParticipantSession.findUnique({
    where: { participantSid: participant.sid },
  });

  // A `left` with no matching `joined` means we missed the join event. Record
  // it anyway with a zero-length presence so the row is not silently dropped.
  if (!row) {
    const metadata = parseParticipantMetadata(participant.metadata);
    await db.liveParticipantSession.create({
      data: {
        classSessionId,
        userId: metadata?.userId ?? participant.identity,
        role: metadata?.role === "TEACHER" ? "TEACHER" : "STUDENT",
        identity: participant.identity,
        participantSid: participant.sid,
        joinedAt: toDate(participant.joinedAt, occurredAt),
        leftAt: occurredAt,
        durationSeconds: 0,
        disconnectReason: "JOIN_EVENT_MISSING",
      },
    });
    return { handled: true, duplicate: false, event: event.event, classSessionId };
  }

  if (row.leftAt) {
    return { handled: false, duplicate: true, event: event.event, classSessionId };
  }

  const leftAt = occurredAt > row.joinedAt ? occurredAt : row.joinedAt;
  await db.liveParticipantSession.update({
    where: { id: row.id },
    data: {
      leftAt,
      durationSeconds: Math.round((leftAt.getTime() - row.joinedAt.getTime()) / 1000),
      disconnectReason: String(participant.disconnectReason ?? ""),
    },
  });

  return { handled: true, duplicate: false, event: event.event, classSessionId };
}

async function onRoomFinished(event: WebhookEvent, occurredAt: Date): Promise<WebhookResult> {
  const classSessionId = sessionIdFor(event);
  if (!classSessionId) return { handled: false, duplicate: false, event: event.event };

  const session = await db.classSession.findUnique({ where: { id: classSessionId } });
  if (!session) return { handled: false, duplicate: false, event: event.event };

  // Close anybody still marked present. This is what makes the handler
  // order-independent: if `participant_left` never arrives, or arrives after
  // this, presence still ends at the moment the room did.
  const open = await db.liveParticipantSession.findMany({
    where: { classSessionId, leftAt: null },
  });
  for (const row of open) {
    const leftAt = occurredAt > row.joinedAt ? occurredAt : row.joinedAt;
    await db.liveParticipantSession.update({
      where: { id: row.id },
      data: {
        leftAt,
        durationSeconds: Math.round((leftAt.getTime() - row.joinedAt.getTime()) / 1000),
        disconnectReason: row.disconnectReason ?? "ROOM_FINISHED",
      },
    });
  }

  const outcome = await settleClassSession(classSessionId, { endedAt: occurredAt });

  // Telemetry must never fail a webhook that has already moved money.
  try {
    await recordDailyUsage({
      day: occurredAt.toISOString().slice(0, 10),
      connectionSeconds: outcome.connectionSeconds,
      participantSessions: open.length,
      classSessions: 1,
      classSessionId,
    });
  } catch (err) {
    console.error("[livekit] usage rollup failed (non-fatal):", err);
  }

  return {
    handled: true,
    duplicate: outcome.alreadySettled,
    event: event.event,
    classSessionId,
    detail: outcome.reason,
  };
}

async function onEgressProgress(event: WebhookEvent): Promise<WebhookResult> {
  const info = event.egressInfo;
  if (!info) return { handled: false, duplicate: false, event: event.event };
  const classSessionId = sessionIdFromRoomName(info.roomName ?? "");
  if (!classSessionId) return { handled: false, duplicate: false, event: event.event };

  await db.classSession.updateMany({
    where: { id: classSessionId },
    data: { lkEgressId: info.egressId, recordingStatus: "RECORDING" },
  });

  return { handled: true, duplicate: false, event: event.event, classSessionId };
}

async function onEgressEnded(event: WebhookEvent): Promise<WebhookResult> {
  const info = event.egressInfo;
  if (!info) return { handled: false, duplicate: false, event: event.event };
  const classSessionId = sessionIdFromRoomName(info.roomName ?? "");
  if (!classSessionId) return { handled: false, duplicate: false, event: event.event };

  const file = info.fileResults?.[0];
  const failed = String(info.status ?? "").includes("FAILED") || Boolean(info.error);

  if (failed) {
    await db.classSession.updateMany({
      where: { id: classSessionId },
      data: {
        recordingStatus: "FAILED",
        recordingError: String(info.error ?? "Egress failed").slice(0, 500),
      },
    });
    return { handled: true, duplicate: false, event: event.event, classSessionId };
  }

  // `location` is the storage URL. It is stored raw; the download route signs
  // it at request time so a leaked database row is not a leaked recording.
  const durationSeconds = file?.duration ? Math.round(Number(file.duration) / 1_000_000_000) : null;

  await db.classSession.updateMany({
    where: { id: classSessionId },
    data: {
      recordingStatus: "AVAILABLE",
      recordingUrl: file?.location ?? file?.filename ?? null,
      recordingDurationSeconds: durationSeconds,
      recordingSizeBytes: file?.size ? BigInt(file.size) : null,
    },
  });

  try {
    const session = await db.classSession.findUnique({
      where: { id: classSessionId },
      select: { recordingMode: true },
    });
    const seconds = durationSeconds ?? 0;
    await recordDailyUsage({
      day: new Date().toISOString().slice(0, 10),
      egressVideoSeconds: session?.recordingMode === "VIDEO" ? seconds : 0,
      egressAudioSeconds: session?.recordingMode === "AUDIO" ? seconds : 0,
    });
  } catch (err) {
    console.error("[livekit] egress usage rollup failed (non-fatal):", err);
  }

  return { handled: true, duplicate: false, event: event.event, classSessionId };
}

/**
 * Reconciliation sweeper.
 *
 * Webhooks get lost — a deploy mid-class, a cold start that times out, an
 * outage. Any class whose grace window has passed but which is still ONGOING
 * or still has a HELD billing row gets settled from whatever presence data we
 * do have. Run it every 10 minutes from a cron.
 *
 * Without this, a dropped `room_finished` leaves a student's coins held
 * forever and nobody notices until they complain.
 */
export async function reconcileStaleSessions(limit = 50): Promise<SettlementSummary> {
  const config = getLiveKitConfig();
  const cutoff = new Date(Date.now() - (config.graceMinutes + 5) * 60_000);

  const stale = await db.classSession.findMany({
    where: {
      scheduledEnd: { lt: cutoff },
      OR: [{ status: { in: ["SCHEDULED", "ONGOING"] } }, { billing: { status: "HELD" } }],
    },
    select: { id: true },
    take: limit,
  });

  const settled: string[] = [];
  const failed: Array<{ id: string; error: string }> = [];

  for (const { id } of stale) {
    try {
      await settleClassSession(id);
      settled.push(id);
    } catch (err) {
      failed.push({ id, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return { examined: stale.length, settled, failed };
}

export interface SettlementSummary {
  examined: number;
  settled: string[];
  failed: Array<{ id: string; error: string }>;
}

/**
 * Admin live-monitoring queries.
 *
 * Joins LiveKit's live room state to our own database so the admin panel can
 * show what is happening right now, not merely what was scheduled.
 */

import { db } from "@repo/database";
import {
  endClassRoom,
  listActiveClassRooms,
  listClassParticipants,
  removeParticipant,
} from "@repo/livekit/server";
import { sessionIdFromRoomName } from "@repo/livekit";

import { stopRecording } from "./recording";
import { settleClassSession } from "./settlement";

export interface LiveRoomView {
  classSessionId: string;
  roomName: string;
  roomSid: string;
  startedAt: string | null;
  numParticipants: number;
  participants: Array<{
    identity: string;
    name: string;
    role: string;
    joinedAt: string | null;
    isPublishing: boolean;
  }>;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  /** True once the room has outlived its slot — the overrun signal. */
  isOverrunning: boolean;
  studentName: string | null;
  teacherName: string | null;
  recordingStatus: string | null;
  /** Live minute counter for this room so far. */
  elapsedMinutes: number;
}

export async function getLiveRooms(): Promise<LiveRoomView[]> {
  const rooms = await listActiveClassRooms();
  if (rooms.length === 0) return [];

  const ids = rooms
    .map((r) => sessionIdFromRoomName(r.name))
    .filter((id): id is string => Boolean(id));

  const sessions = await db.classSession.findMany({
    where: { id: { in: ids } },
    include: {
      booking: {
        include: {
          student: { select: { name: true, userId: true } },
          teacher: { select: { name: true, userId: true } },
        },
      },
    },
  });
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const now = Date.now();

  const views = await Promise.all(
    rooms.map(async (room): Promise<LiveRoomView | null> => {
      const classSessionId = sessionIdFromRoomName(room.name);
      if (!classSessionId) return null;
      const session = byId.get(classSessionId);
      const participants = await listClassParticipants(classSessionId);
      const startedMs = room.creationTime ? Number(room.creationTime) * 1000 : null;

      return {
        classSessionId,
        roomName: room.name,
        roomSid: room.sid,
        startedAt: startedMs ? new Date(startedMs).toISOString() : null,
        numParticipants: room.numParticipants ?? participants.length,
        participants: participants.map((p) => ({
          identity: p.identity,
          name: p.name || p.identity,
          role:
            p.identity === session?.booking.teacherId
              ? "TEACHER"
              : p.identity === session?.booking.studentId
                ? "STUDENT"
                : "OBSERVER",
          joinedAt: p.joinedAt ? new Date(Number(p.joinedAt) * 1000).toISOString() : null,
          isPublishing: (p.tracks?.length ?? 0) > 0,
        })),
        scheduledStart: session?.scheduledStart.toISOString() ?? null,
        scheduledEnd: session?.scheduledEnd.toISOString() ?? null,
        isOverrunning: session ? now > session.scheduledEnd.getTime() : false,
        studentName: session?.booking.student.name ?? null,
        teacherName: session?.booking.teacher.name ?? null,
        recordingStatus: session?.recordingStatus ?? null,
        elapsedMinutes: startedMs ? Math.round((now - startedMs) / 60_000) : 0,
      };
    })
  );

  return views
    .filter((v): v is LiveRoomView => v !== null)
    .sort((a, b) => Number(b.isOverrunning) - Number(a.isOverrunning));
}

/**
 * Force-end a class from the admin panel.
 *
 * Stops recording first so the file is finalised, then closes the room, then
 * settles. Settling last means the student is billed for the minutes they
 * actually had, including the ones right before the admin intervened.
 */
export async function forceEndClass(
  classSessionId: string,
  adminId: string,
  reason: string
): Promise<void> {
  await stopRecording(classSessionId).catch(() => {});
  await endClassRoom(classSessionId);
  await settleClassSession(classSessionId, { endedAt: new Date() });

  await db.adminAuditLog.create({
    data: {
      actorId: adminId,
      adminId,
      eventType: "FORCE_END_CLASS",
      outcome: "success",
      userAgent: reason.slice(0, 200),
    },
  });
}

export async function kickParticipant(
  classSessionId: string,
  identity: string,
  adminId: string
): Promise<void> {
  await removeParticipant(classSessionId, identity);
  await db.adminAuditLog.create({
    data: {
      actorId: adminId,
      adminId,
      eventType: "REMOVE_CLASS_PARTICIPANT",
      outcome: "success",
      userAgent: `${classSessionId}:${identity}`.slice(0, 200),
    },
  });
}

/** Sessions whose settlement needs a human — teacher no-shows, mostly. */
export async function getSessionsNeedingReview(limit = 50) {
  return db.sessionBilling.findMany({
    where: { requiresReview: true },
    orderBy: { settledAt: "desc" },
    take: limit,
    include: {
      classSession: {
        include: {
          booking: {
            include: {
              student: { select: { name: true } },
              teacher: { select: { name: true } },
            },
          },
        },
      },
    },
  });
}

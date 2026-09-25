/**
 * Class recording.
 *
 * Recording is opt-in per class and defaults to AUDIO. That default is worth
 * defending: LiveKit charges $0.02/min to transcode composite video and
 * $0.005/min for audio, so a 60-minute class costs $1.20 to record as video
 * and $0.30 as audio — before storage or the bandwidth to write the file.
 *
 * For a language lesson the audio is the artefact. Students replay
 * pronunciation; they do not replay a webcam. Four times the price for none
 * of the value is the kind of default that quietly becomes the largest line
 * on the bill.
 */

import { db } from "@repo/database";
import {
  startClassRecording,
  stopClassRecording,
  type RecordingMode,
} from "@repo/livekit/server";

export type RecordingDenialCode =
  | "SESSION_NOT_FOUND"
  | "NOT_PERMITTED"
  | "NOT_PAID"
  | "ALREADY_RECORDING"
  | "SESSION_NOT_LIVE"
  | "STORAGE_NOT_CONFIGURED";

export interface RecordingDenial {
  ok: false;
  code: RecordingDenialCode;
  message: string;
  httpStatus: number;
}

export interface RecordingStarted {
  ok: true;
  egressId: string;
  mode: RecordingMode;
  estimatedCostUsdPerHour: number;
}

export async function startRecording(params: {
  classSessionId: string;
  requestedBy: string;
  role: "TEACHER" | "ADMIN";
  mode?: RecordingMode;
}): Promise<RecordingStarted | RecordingDenial> {
  const session = await db.classSession.findUnique({
    where: { id: params.classSessionId },
    include: { booking: { select: { teacherId: true } } },
  });

  if (!session) {
    return { ok: false, code: "SESSION_NOT_FOUND", message: "Class not found.", httpStatus: 404 };
  }
  if (params.role !== "ADMIN" && session.booking.teacherId !== params.requestedBy) {
    return {
      ok: false,
      code: "NOT_PERMITTED",
      message: "Only the teacher of this class can start a recording.",
      httpStatus: 403,
    };
  }
  if (!session.isRecordingPaid && params.role !== "ADMIN") {
    return {
      ok: false,
      code: "NOT_PAID",
      message: "Recording has not been purchased for this class.",
      httpStatus: 402,
    };
  }
  if (session.recordingStatus === "RECORDING" || session.lkEgressId) {
    return {
      ok: false,
      code: "ALREADY_RECORDING",
      message: "This class is already being recorded.",
      httpStatus: 409,
    };
  }
  if (session.status !== "ONGOING") {
    return {
      ok: false,
      code: "SESSION_NOT_LIVE",
      message: "A class can only be recorded while it is live.",
      httpStatus: 409,
    };
  }

  const mode = params.mode ?? "audio";

  try {
    const { egressId } = await startClassRecording({
      classSessionId: params.classSessionId,
      mode,
      filenamePrefix: `recordings/${params.classSessionId}/${Date.now()}`,
    });

    await db.classSession.update({
      where: { id: params.classSessionId },
      data: {
        lkEgressId: egressId,
        recordingStatus: "RECORDING",
        recordingMode: mode === "audio" ? "AUDIO" : "VIDEO",
        recordingError: null,
      },
    });

    return {
      ok: true,
      egressId,
      mode,
      estimatedCostUsdPerHour: mode === "audio" ? 0.3 : 1.2,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/not configured/i.test(message)) {
      return {
        ok: false,
        code: "STORAGE_NOT_CONFIGURED",
        message,
        httpStatus: 503,
      };
    }
    await db.classSession.update({
      where: { id: params.classSessionId },
      data: { recordingStatus: "FAILED", recordingError: message.slice(0, 500) },
    });
    throw err;
  }
}

export async function stopRecording(classSessionId: string): Promise<void> {
  const session = await db.classSession.findUnique({
    where: { id: classSessionId },
    select: { lkEgressId: true },
  });
  if (!session?.lkEgressId) return;

  await stopClassRecording(session.lkEgressId);
  await db.classSession.update({
    where: { id: classSessionId },
    data: { recordingStatus: "PROCESSING" },
  });
}

export type RecordingAccessCode =
  | "OK"
  | "NOT_A_PARTICIPANT"
  | "SESSION_NOT_COMPLETED"
  | "RECORDING_PROCESSING"
  | "NOT_PAID";

/**
 * Who may download a recording.
 *
 * Kept as a pure function of already-loaded fields so it can be unit-tested
 * and so the same rule applies on web, mobile and admin without three
 * slightly different copies of it.
 */
export function canAccessRecording(params: {
  userId: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  session: {
    studentId: string;
    teacherId: string;
    recordingUrl: string | null;
    recordingStatus: string;
    isRecordingPaid: boolean;
    status: string;
  };
}): { allowed: boolean; code: RecordingAccessCode; message?: string } {
  const { userId, role, session } = params;

  if (role === "ADMIN") return { allowed: true, code: "OK" };

  if (session.studentId !== userId && session.teacherId !== userId) {
    return {
      allowed: false,
      code: "NOT_A_PARTICIPANT",
      message: "You were not part of this class.",
    };
  }
  if (session.status !== "COMPLETED") {
    return {
      allowed: false,
      code: "SESSION_NOT_COMPLETED",
      message: "The recording is available once the class has finished.",
    };
  }
  // The teacher always gets their own class back; the paywall is on students.
  if (role === "STUDENT" && !session.isRecordingPaid) {
    return {
      allowed: false,
      code: "NOT_PAID",
      message: "Unlock this recording to listen back to your class.",
    };
  }
  if (!session.recordingUrl || session.recordingStatus !== "AVAILABLE") {
    return {
      allowed: false,
      code: "RECORDING_PROCESSING",
      message: "The recording is still processing. Check back in a few minutes.",
    };
  }
  return { allowed: true, code: "OK" };
}

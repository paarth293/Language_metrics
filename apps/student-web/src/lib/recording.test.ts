import { describe, test, expect } from "vitest";

// Domain logic for recording retrieval
export interface RecordingAccessCheckParams {
  userId: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  session: {
    studentId: string;
    teacherId: string;
    recordingUrl: string | null;
    status: "SCHEDULED" | "ONGOING" | "COMPLETED" | "CANCELLED";
  };
}

export function canAccessRecording(params: RecordingAccessCheckParams): { allowed: boolean; reason?: string } {
  const { userId, role, session } = params;

  if (role === "ADMIN") {
    return { allowed: true };
  }

  const isParticipant = session.studentId === userId || session.teacherId === userId;
  if (!isParticipant) {
    return { allowed: false, reason: "NOT_A_PARTICIPANT" };
  }

  if (session.status !== "COMPLETED") {
    return { allowed: false, reason: "SESSION_NOT_COMPLETED" };
  }

  if (!session.recordingUrl) {
    return { allowed: false, reason: "RECORDING_PROCESSING" };
  }

  return { allowed: true };
}

export function generateSignedRecordingUrl(rawUrl: string, expiresInSeconds = 3600): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  return `${rawUrl}?expires=${expiresAt}&signature=mock_signed_sig`;
}

describe("Session Recording Retrieval (student-web)", () => {
  const baseSession = {
    studentId: "student-123",
    teacherId: "teacher-456",
    recordingUrl: "https://storage.example.com/recordings/sess-001.mp4",
    status: "COMPLETED" as const,
  };

  test("allows enrolled student to access completed session recording", () => {
    const result = canAccessRecording({
      userId: "student-123",
      role: "STUDENT",
      session: baseSession,
    });
    expect(result.allowed).toBe(true);
  });

  test("allows session teacher to access completed session recording", () => {
    const result = canAccessRecording({
      userId: "teacher-456",
      role: "TEACHER",
      session: baseSession,
    });
    expect(result.allowed).toBe(true);
  });

  test("allows admin to access recording for moderation", () => {
    const result = canAccessRecording({
      userId: "admin-999",
      role: "ADMIN",
      session: baseSession,
    });
    expect(result.allowed).toBe(true);
  });

  test("rejects non-participant student with NOT_A_PARTICIPANT", () => {
    const result = canAccessRecording({
      userId: "unrelated-student-789",
      role: "STUDENT",
      session: baseSession,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("NOT_A_PARTICIPANT");
  });

  test("handles processing / missing recording gracefully", () => {
    const pendingSession = {
      ...baseSession,
      recordingUrl: null,
    };
    const result = canAccessRecording({
      userId: "student-123",
      role: "STUDENT",
      session: pendingSession,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("RECORDING_PROCESSING");
  });

  test("rejects access if session is still ONGOING", () => {
    const ongoingSession = {
      ...baseSession,
      status: "ONGOING" as const,
    };
    const result = canAccessRecording({
      userId: "student-123",
      role: "STUDENT",
      session: ongoingSession,
    });
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("SESSION_NOT_COMPLETED");
  });

  test("generates signed temporary URL with expiration parameter", () => {
    const signed = generateSignedRecordingUrl("https://storage.example.com/rec.mp4", 1800);
    expect(signed).toContain("expires=");
    expect(signed).toContain("signature=");
  });
});

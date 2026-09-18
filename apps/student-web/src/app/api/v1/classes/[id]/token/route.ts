import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/auth-mobile";
import { generateLiveKitToken } from "@/lib/livekit";
import {
  LiveKitTokenResponseSchema,
  type LiveKitTokenResponse,
} from "@repo/api-contracts";

/**
 * POST /api/v1/classes/[id]/token
 *
 * Mobile endpoint returning a scoped LiveKit WebRTC access token for classroom entry.
 * Validates session ownership and student role.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const studentId = auth.user.id;

  try {
    const { id: sessionId } = await params;

    const session = await db.classSession.findUnique({
      where: { id: sessionId },
      include: {
        booking: {
          include: {
            student: { select: { name: true } },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ message: "Session not found." }, { status: 404 });
    }

    if (session.booking.studentId !== studentId) {
      return NextResponse.json({ message: "Forbidden: Not your class." }, { status: 403 });
    }

    const roomName = `class-${sessionId}`;
    const studentName = session.booking.student?.name || "Student";

    const { token, wsUrl } = await generateLiveKitToken({
      roomName,
      identity: studentId,
      name: studentName,
      role: "student",
      ttl: 4 * 60 * 60, // 4 hours
    });

    // Mark session ONGOING if it was SCHEDULED
    if (session.status === "SCHEDULED") {
      await db.classSession.update({
        where: { id: sessionId },
        data: { status: "ONGOING", actualStart: new Date() },
      });
    }

    // Normalizing WS/WSS URL to http/https for strict URL validator if needed
    const normalizedServerUrl = wsUrl.startsWith("ws://")
      ? wsUrl.replace("ws://", "http://")
      : wsUrl.startsWith("wss://")
        ? wsUrl.replace("wss://", "https://")
        : wsUrl;

    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    const responsePayload: LiveKitTokenResponse = {
      token,
      serverUrl: normalizedServerUrl,
      roomName,
      participantIdentity: studentId,
      participantName: studentName,
      expiresAt,
    };

    const validated = LiveKitTokenResponseSchema.parse(responsePayload);
    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error("[Mobile API] LiveKit token error:", error);
    return NextResponse.json({ message: "Failed to generate classroom token." }, { status: 500 });
  }
}

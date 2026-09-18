import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateLiveKitToken } from "@/lib/livekit";

// POST - Get LiveKit token for a session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const { id: sessionId } = await params;

    // Get the session and verify the student has access
    const session = await prisma.classSession.findUnique({
      where: { id: sessionId },
      include: {
        booking: true,
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.booking.studentId !== userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Check join window (5 minutes before scheduled start until scheduled end)
    const now = new Date();
    const joinWindowStart = new Date(
      session.scheduledStart.getTime() - 5 * 60 * 1000
    );

    if (now < joinWindowStart) {
      return NextResponse.json(
        {
          error: "Class hasn't started yet. Join opens 5 minutes before.",
          joinAt: joinWindowStart.toISOString(),
        },
        { status: 400 }
      );
    }

    if (now > session.scheduledEnd) {
      return NextResponse.json(
        { error: "This session has ended" },
        { status: 400 }
      );
    }

    const roomName = `class-${sessionId}`;

    // BUG FIX: this route was building `token = \`dev-token-${userId}-${sessionId}\``
    // itself instead of calling the real token generator that already
    // exists in this app's own lib/livekit.ts. That string isn't a LiveKit
    // access token at all — it isn't signed, carries no room grant, and
    // LiveKit's real server would reject it outright. In production
    // (LIVEKIT_API_KEY/SECRET/WS_URL set) this meant students could never
    // actually join a video session — the join button would always fail
    // against the real LiveKit server. generateLiveKitToken() already
    // handles both cases correctly: a real signed JWT when LiveKit is
    // configured, and the same kind of mock token for local dev when it
    // isn't — so this now behaves identically in dev and correctly in
    // production, with zero new dependencies (the function already existed
    // in this file and already degrades gracefully; see lib/livekit.ts).
    // NOTE: this codebase also has a separate, independent copy of
    // lib/livekit.ts under apps/teacher-web — this fix only touches
    // student-web's copy. See errors.md, "Before you deploy," for why
    // teacher-web's equivalent route needs its own check.
    const { token, wsUrl } = await generateLiveKitToken({
      roomName,
      identity: userId,
      name: "Student",
      role: "student",
    });

    // Update session status if needed
    if (session.status === "SCHEDULED") {
      await prisma.classSession.update({
        where: { id: sessionId },
        data: { status: "ONGOING" },
      });
    }

    return NextResponse.json({
      token,
      roomName,
      // FIX: previously read `process.env.LIVEKIT_WS_URL` directly here,
      // duplicating (and risking drifting from) the same env var lib/livekit.ts
      // already reads and falls back on. Using the value the token generator
      // itself returns guarantees the wsUrl always matches the server the
      // token was actually signed for.
      wsUrl,
    });
  } catch (error) {
    console.error("Failed to get LiveKit token:", error);
    return NextResponse.json(
      { error: "Failed to generate session token" },
      { status: 500 }
    );
  }
}

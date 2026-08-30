import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
    // Generate a simple token for development
    // In production, install livekit-server-sdk and use AccessToken
    const token = `dev-token-${userId}-${sessionId}`;

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
      wsUrl: process.env.LIVEKIT_WS_URL || "ws://localhost:7880",
    });
  } catch (error) {
    console.error("Failed to get LiveKit token:", error);
    return NextResponse.json(
      { error: "Failed to generate session token" },
      { status: 500 }
    );
  }
}

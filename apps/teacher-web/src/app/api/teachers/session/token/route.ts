import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { generateLiveKitToken, isLiveKitConfigured } from "@/lib/livekit";
import { db } from "@/lib/db";

/**
 * POST /api/teachers/session/token
 * Generate a LiveKit access token for joining a class session.
 * Body: { sessionId: string; bookingId: string }
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { sessionId, bookingId } = body;

    if (!sessionId || !bookingId) {
      return NextResponse.json(
        { message: "sessionId and bookingId are required." },
        { status: 400 }
      );
    }

    const roomName = sessionId ? `class-${sessionId}` : `session_${bookingId}`;

    // Verify the teacher owns this booking/session
    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      select: { teacherId: true },
    });

    if (!booking) {
      return NextResponse.json({ message: "Booking not found." }, { status: 404 });
    }

    if (booking.teacherId !== auth.user.sub) {
      return NextResponse.json(
        { message: "Forbidden: You are not assigned to this session." },
        { status: 403 }
      );
    }

    const result = await generateLiveKitToken({
      roomName,
      identity: auth.user.sub,
      name: auth.user.sub, // Will be resolved to display name client-side
      role: "teacher",
    });

    return NextResponse.json(
      {
        token: result.token,
        wsUrl: result.wsUrl,
        roomName,
        configured: isLiveKitConfigured(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("POST /api/teachers/session/token error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

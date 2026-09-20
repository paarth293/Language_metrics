/**
 * GET /api/admin/live/rooms — every class in progress right now.
 *
 * Reads LiveKit's live room list directly (not our database), because the
 * point of this screen is to see reality: a room that exists in LiveKit but
 * not in our tables is exactly the anomaly an admin needs to catch.
 */
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getLiveRooms } from "@repo/live-classes";
import { isLiveKitConfigured } from "@repo/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, "classes:manage");
  if (!auth.ok) return auth.response;

  if (!isLiveKitConfigured()) {
    return NextResponse.json({ rooms: [], configured: false }, { status: 200 });
  }

  try {
    const rooms = await getLiveRooms();
    return NextResponse.json(
      { rooms, configured: true, fetchedAt: new Date().toISOString() },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[admin/live/rooms]", err);
    return NextResponse.json(
      { message: "Could not reach LiveKit.", rooms: [], configured: true },
      { status: 502 }
    );
  }
}

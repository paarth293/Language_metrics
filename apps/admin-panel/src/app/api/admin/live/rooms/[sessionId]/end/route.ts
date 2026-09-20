/**
 * POST /api/admin/live/rooms/[sessionId]/end — force-end a class.
 *
 * Stops recording, closes the room, settles the student's coins for the
 * minutes they actually received, and writes an audit log entry. Used for
 * runaway rooms and for abuse reports.
 */
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { forceEndClass } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireApiAdmin(request, "classes:manage");
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;
  let reason = "Ended by admin";
  try {
    const body = (await request.json()) as { reason?: string };
    if (typeof body?.reason === "string" && body.reason.trim()) reason = body.reason.trim();
  } catch {
    // reason is optional
  }

  try {
    await forceEndClass(sessionId, auth.admin.id, reason);
    return NextResponse.json({ ended: true, sessionId, reason }, { status: 200 });
  } catch (err) {
    console.error("[admin/live/end]", err);
    return NextResponse.json({ message: "Failed to end the class." }, { status: 500 });
  }
}

/**
 * POST /api/admin/live/rooms/[sessionId]/kick — remove one participant.
 * Their token is still valid, so a removal is not a ban; it ends the
 * connection (and the minutes it is costing) immediately.
 */
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { kickParticipant } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireApiAdmin(request, "classes:manage");
  if (!auth.ok) return auth.response;

  const { sessionId } = await params;
  let identity: string;
  try {
    const body = (await request.json()) as { identity?: string };
    if (typeof body?.identity !== "string" || !body.identity) {
      return NextResponse.json({ message: "identity is required." }, { status: 400 });
    }
    identity = body.identity;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  await kickParticipant(sessionId, identity, auth.admin.id);
  return NextResponse.json({ removed: true, identity }, { status: 200 });
}

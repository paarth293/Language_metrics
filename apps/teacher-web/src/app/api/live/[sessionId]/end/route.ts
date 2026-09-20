/**
 * POST /api/live/[sessionId]/end — teacher ends the class.
 * Closes the room (stopping connection minutes at once) and settles.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleEndClass } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request, "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  const { sessionId } = await params;
  const result = await handleEndClass({ userId: auth.user.sub, role: auth.user.role }, sessionId);
  return NextResponse.json(result.body, { status: result.status });
}

/**
 * GET /api/live/[sessionId]/status — waiting-room poll.
 * Reads our own tables, not LiveKit's API, because this endpoint is polled.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleSessionStatus } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request, "STUDENT", "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  const { sessionId } = await params;
  const result = await handleSessionStatus(
    { userId: auth.user.sub, role: auth.user.role },
    sessionId
  );
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

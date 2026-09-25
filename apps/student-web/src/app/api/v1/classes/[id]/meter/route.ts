/**
 * GET /api/v1/classes/[id]/meter — mobile billing meter.
 * Bearer-authenticated twin of /api/live/[sessionId]/meter.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth-mobile";
import { handleMeter } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const result = await handleMeter({ userId: auth.user.id, role: "STUDENT" }, id);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

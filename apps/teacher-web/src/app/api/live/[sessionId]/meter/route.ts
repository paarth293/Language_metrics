/**
 * GET /api/live/[sessionId]/meter — live billing meter.
 *
 * Uses the same computeBillableWindow/settleSession pair that settlement
 * uses, so what the student watches tick up is what they will be charged.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { handleMeter } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth(request, "STUDENT", "TEACHER", "ADMIN");
  if (auth.error) return auth.error;

  const { sessionId } = await params;
  const result = await handleMeter({ userId: auth.user.sub, role: auth.user.role }, sessionId);
  return NextResponse.json(result.body, {
    status: result.status,
    headers: { "Cache-Control": "no-store" },
  });
}

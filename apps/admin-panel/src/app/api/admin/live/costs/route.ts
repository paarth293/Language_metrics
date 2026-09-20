/**
 * GET /api/admin/live/costs — month-to-date LiveKit spend.
 *
 * Everything the cost page renders: usage against allowances, marginal cost,
 * budget verdict, remaining free class-minutes and a daily series.
 */
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getCostReport } from "@repo/live-classes";
import { estimateSessionCost } from "@repo/livekit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, "analytics:view");
  if (!auth.ok) return auth.response;

  const report = await getCostReport();

  // What one more 60-minute class costs at each quality setting, so the
  // trade-off is visible at the moment someone is deciding whether to change
  // the default rather than buried in documentation.
  const perClass = (["audio-only", "low", "standard", "high"] as const).map((profile) => ({
    profile,
    ...estimateSessionCost({ durationMinutes: 60, participants: 2, profile, marginal: true }),
  }));

  return NextResponse.json(
    { ...report, perClass },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}

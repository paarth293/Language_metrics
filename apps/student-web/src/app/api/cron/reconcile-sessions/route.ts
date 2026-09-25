/**
 * GET /api/cron/reconcile-sessions
 *
 * Safety net for lost webhooks. A deploy mid-class, a cold start that times
 * out, or a LiveKit incident can swallow `room_finished` — and when that
 * happens a student's coins stay held forever and nobody finds out until they
 * write in. This sweeps any class past its grace window and settles it from
 * whatever presence data did arrive.
 *
 * Wire it up in vercel.json:
 *   { "crons": [{ "path": "/api/cron/reconcile-sessions", "schedule": "*\/10 * * * *" }] }
 */
import { NextRequest, NextResponse } from "next/server";
import { reconcileStaleSessions } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Vercel Cron sends this header; a stray public request must not be able to
  // trigger settlement.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const provided = request.headers.get("authorization");
    if (provided !== `Bearer ${secret}`) {
      return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
    }
  }

  const summary = await reconcileStaleSessions();
  if (summary.failed.length > 0) {
    console.error("[reconcile] some sessions failed to settle:", summary.failed);
  }
  return NextResponse.json(summary, { status: 200 });
}

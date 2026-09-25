/**
 * GET /api/cron/reconcile-sessions
 *
 * Safety net for lost webhooks. A deploy mid-class, a cold start that times
 * out, or a LiveKit incident can swallow `room_finished` — and when that
 * happens a student's coins stay held forever and nobody finds out until they
 * write in. This sweeps any class past its grace window and settles it from
 * whatever presence data did arrive.
 *
 * Triggered from two places:
 *   - .github/workflows/reconcile-sessions.yml — every 10 minutes (primary)
 *   - vercel.json crons — daily (fallback; Hobby forbids sub-daily schedules)
 *
 * Both send `Authorization: Bearer <CRON_SECRET>`. Vercel adds that header
 * automatically when CRON_SECRET is set as an environment variable on the
 * deployment, so the same check covers both callers.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { reconcileStaleSessions } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time comparison of the Authorization header against the expected
 * bearer token.
 *
 * Both sides are hashed first so `timingSafeEqual` always receives buffers of
 * equal length — it throws otherwise, and a length check before comparing
 * would leak the secret's length.
 */
function isAuthorised(request: NextRequest, secret: string): boolean {
  const provided = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  // Fail closed. Previously a missing CRON_SECRET skipped the check entirely,
  // which left settlement publicly triggerable on any deployment that forgot
  // to set it — the one configuration where you least want an open endpoint.
  if (!secret) {
    console.error(
      "[reconcile] CRON_SECRET is not set — refusing to run. Set it on the deployment."
    );
    return NextResponse.json(
      { message: "Endpoint misconfigured." },
      { status: 500 }
    );
  }

  if (!isAuthorised(request, secret)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const summary = await reconcileStaleSessions();
  if (summary.failed.length > 0) {
    console.error("[reconcile] some sessions failed to settle:", summary.failed);
  }
  return NextResponse.json(summary, { status: 200 });
}

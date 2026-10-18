/**
 * GET /api/cron/reconcile-payments
 *
 * Safety net for lost payment confirmations. If a student closes the tab
 * before checkout verifies and the Cashfree webhook never lands, the money is
 * taken and the order sits at CREATED. This sweep asks Cashfree about every
 * such order and settles, expires or reports it.
 *
 * Triggered from .github/workflows/reconcile-payments.yml every 10 minutes
 * (primary) and vercel.json daily (fallback), both with
 * `Authorization: Bearer <CRON_SECRET>`.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { reconcilePaymentOrders } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hash both sides so timingSafeEqual compares equal-length buffers. */
function isAuthorised(request: NextRequest, secret: string): boolean {
  const provided = request.headers.get("authorization") ?? "";
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(`Bearer ${secret}`).digest();
  return timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[reconcile-payments] CRON_SECRET is not set — refusing to run. Set it on the deployment.");
    return NextResponse.json({ message: "Endpoint misconfigured." }, { status: 500 });
  }
  if (!isAuthorised(request, secret)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  const summary = await reconcilePaymentOrders();
  if (summary.failed.length > 0 || summary.stuck.length > 0) {
    console.error("[reconcile-payments] orders need attention:", { failed: summary.failed, stuck: summary.stuck });
  }
  return NextResponse.json(summary, { status: 200 });
}

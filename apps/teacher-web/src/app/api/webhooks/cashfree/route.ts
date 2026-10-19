import { CashfreeError, handleCashfreeWebhook, verifyCashfreeWebhook } from "@repo/live-classes";
import { NextResponse } from "next/server";
import { requestLogger } from "@repo/logger";
import { withServerErrorAlerts } from "@repo/logger/ops-alert";

// 5xx answers are counted for the repeated-5xx ops alert (#8e).
export const POST = withServerErrorAlerts("teacher-web webhooks/cashfree", async (req: Request) => {
  try {
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    const raw = await req.text();
    if (!verifyCashfreeWebhook(raw, signature, timestamp)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    const { flagged } = await handleCashfreeWebhook(JSON.parse(raw));
    return NextResponse.json(flagged ? { success: true, flagged } : { success: true });
  } catch (error) {
    if (error instanceof CashfreeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    requestLogger(req).error("cashfree webhook failed", { error });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

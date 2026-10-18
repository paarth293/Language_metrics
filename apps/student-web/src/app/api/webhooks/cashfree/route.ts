import { CashfreeError, handleCashfreeWebhook, verifyCashfreeWebhook } from "@repo/live-classes";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

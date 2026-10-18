import { CashfreeError, paymentFromWebhook, RecordingPaymentError, settleGatewayPayment, verifyCashfreeWebhook } from "@repo/live-classes";
import { NextResponse } from "next/server";
import { PaymentError } from "@/lib/payment-settlement";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    const raw = await req.text();
    if (!verifyCashfreeWebhook(raw, signature, timestamp)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    const payment = paymentFromWebhook(JSON.parse(raw));
    if (payment) await settleGatewayPayment(payment);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentError || error instanceof RecordingPaymentError || error instanceof CashfreeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

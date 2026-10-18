import { CashfreeError, flagPaymentForReview, isPermanentPaymentError, paymentFromWebhook, settleGatewayPayment, verifyCashfreeWebhook } from "@repo/live-classes";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-webhook-signature");
    const timestamp = req.headers.get("x-webhook-timestamp");
    if (!signature || !timestamp) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    const raw = await req.text();
    if (!verifyCashfreeWebhook(raw, signature, timestamp)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    const payment = paymentFromWebhook(JSON.parse(raw));
    if (payment) {
      try {
        await settleGatewayPayment(payment);
      } catch (error) {
        // Cashfree has the money; bouncing a permanent failure would make it
        // give up and the payment would vanish. Keep it for a human instead.
        if (!isPermanentPaymentError(error)) throw error;
        await flagPaymentForReview(payment, error.message);
        return NextResponse.json({ success: true, flagged: true });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof CashfreeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

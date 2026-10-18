import { db } from "@repo/database";
import { settleRecordingPayment, RecordingPaymentError } from "@repo/live-classes";
import { NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/razorpay-verify";
import { PaymentError, settlePayment } from "@/lib/payment-settlement";

export async function POST(req: Request) {
  try {
    const signature = req.headers.get("x-razorpay-signature");
    if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    const raw = await req.text();
    if (!verifyWebhookSignature(raw, signature)) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    const payload = JSON.parse(raw);
    if (payload.event === "payment.captured" || payload.event === "order.paid") {
      const payment = payload.payload?.payment?.entity;
      if (!payment || typeof payment.order_id !== "string") return NextResponse.json({ error: "Invalid payment details" }, { status: 400 });
      const order = await db.razorpayOrder.findUnique({ where: { orderId: payment.order_id } });
      if (order?.receipt?.startsWith("rec_")) await settleRecordingPayment(payment);
      else await settlePayment(payment);
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentError || error instanceof RecordingPaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

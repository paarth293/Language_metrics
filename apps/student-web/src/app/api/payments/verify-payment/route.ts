import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { verifyRazorpaySignature } from "@/lib/razorpay-verify";
import { PaymentError, settlePayment } from "@/lib/payment-settlement";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "STUDENT");
    if (auth.error) return auth.error;
    const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = await req.json();
    if (typeof orderId !== "string" || !orderId || typeof paymentId !== "string" || !paymentId
        || typeof signature !== "string" || !signature) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }
    const order = await db.razorpayOrder.findUnique({ where: { orderId } });
    if (!order || order.userId !== auth.user.sub) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!verifyRazorpaySignature(order.orderId, paymentId, signature)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
    const authorization = "Basic " + Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64");
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: authorization }, cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ error: "Payment confirmation is unavailable. Please try again." }, { status: 502 });
    const payment = await response.json();
    if (payment.id !== paymentId || payment.order_id !== order.orderId) {
      return NextResponse.json({ error: "Payment does not match the order" }, { status: 400 });
    }
    await settlePayment(payment, auth.user.sub, signature);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Verify payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

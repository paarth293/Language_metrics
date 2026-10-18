import { NextResponse } from "next/server";
import { CashfreeError, fetchSuccessfulPayment } from "@repo/live-classes";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { PaymentError, settlePayment } from "@/lib/payment-settlement";

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, "STUDENT");
    if (auth.error) return auth.error;
    const { orderId } = await req.json();
    if (typeof orderId !== "string" || !orderId) {
      return NextResponse.json({ error: "Missing payment details" }, { status: 400 });
    }
    const order = await db.paymentOrder.findUnique({ where: { orderId } });
    if (!order || order.userId !== auth.user.sub) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    // Cashfree is the source of truth; the browser only says which order to check.
    const payment = await fetchSuccessfulPayment(order.orderId);
    if (!payment) {
      return NextResponse.json({ error: "Payment is awaiting confirmation. Your wallet will update once confirmed." }, { status: 409 });
    }
    await settlePayment(payment, auth.user.sub);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof PaymentError || error instanceof CashfreeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    console.error("Verify payment error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

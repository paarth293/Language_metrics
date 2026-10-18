import { credit, db } from "@repo/database";
import type { GatewayPayment } from "@repo/live-classes";
import { COIN_VALUE_INR } from "@/types/coins";

export class PaymentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Both checkout verification and signed webhooks use the same atomic settlement. */
export async function settlePayment(payment: GatewayPayment, userId?: string) {
  if (!payment || typeof payment.id !== "string" || typeof payment.order_id !== "string"
      || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    throw new PaymentError("Invalid payment details", 400);
  }
  return db.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({ where: { orderId: payment.order_id } });
    if (!order) throw new PaymentError("Order not found", 404);
    if (userId && order.userId !== userId) throw new PaymentError("Order not found", 404);
    if (payment.status !== "SUCCESS") throw new PaymentError("Payment is awaiting confirmation. Your wallet will update once confirmed.", 409);
    if (payment.amount !== order.amount * 100 || payment.currency !== order.currency) {
      throw new PaymentError("Payment does not match the order", 400);
    }
    if (order.status === "PAID") {
      if (order.paymentId !== payment.id) throw new PaymentError("Order was paid using another payment", 409);
      return;
    }

    // Receipts snapshot the coin quantity on the server. Without one, the
    // amount paid converts at 1 coin = ₹1 — never a quantity from the browser.
    const savedCoins = /^coins_(\d+)_/.exec(order.receipt ?? "")?.[1];
    const coins = savedCoins ? Number(savedCoins) : order.amount / COIN_VALUE_INR;
    if (!coins || !Number.isSafeInteger(coins) || coins <= 0) {
      throw new PaymentError("Order package could not be identified. Contact support.", 409);
    }

    // This conditional UPDATE serializes simultaneous webhook/checkout retries.
    // The wallet mutation commits with the order or both roll back on failure.
    const claimed = await tx.paymentOrder.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: { status: "PAID", paymentId: payment.id },
    });
    if (!claimed.count) return;
    await credit({
      userId: order.userId, amount: coins, type: "PURCHASE",
      description: "Coin purchase via Cashfree", idempotencyKey: `cashfree:${order.orderId}`,
    }, tx);
  });
}

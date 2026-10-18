import { credit, db } from "@repo/database";
import { COIN_PACKAGES } from "@/types/coins";

export interface CapturedPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

export class PaymentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** Both checkout verification and signed webhooks use the same atomic settlement. */
export async function settlePayment(payment: CapturedPayment, userId?: string, signature?: string) {
  if (!payment || typeof payment.id !== "string" || typeof payment.order_id !== "string"
      || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    throw new PaymentError("Invalid payment details", 400);
  }
  return db.$transaction(async (tx) => {
    const order = await tx.razorpayOrder.findUnique({ where: { orderId: payment.order_id } });
    if (!order) throw new PaymentError("Order not found", 404);
    if (userId && order.userId !== userId) throw new PaymentError("Order not found", 404);
    if (payment.status !== "captured") throw new PaymentError("Payment is awaiting capture. Your wallet will update once confirmed.", 409);
    if (payment.amount !== order.amount * 100 || payment.currency !== order.currency) {
      throw new PaymentError("Payment does not match the order", 400);
    }
    if (order.status === "PAID") {
      if (order.paymentId !== payment.id) throw new PaymentError("Order was paid using another payment", 409);
      return;
    }

    // New receipts snapshot the coin quantity on the server. Legacy orders use
    // the published package price, never a quantity supplied by the browser.
    const savedCoins = /^coins_(\d+)_/.exec(order.receipt ?? "")?.[1];
    const coins = savedCoins ? Number(savedCoins) : COIN_PACKAGES.find((pack) => pack.priceInr === order.amount)?.coins;
    if (!coins || !Number.isSafeInteger(coins) || coins <= 0) {
      throw new PaymentError("Order package could not be identified. Contact support.", 409);
    }

    // This conditional UPDATE serializes simultaneous webhook/checkout retries.
    // The wallet mutation commits with the order or both roll back on failure.
    const claimed = await tx.razorpayOrder.updateMany({
      where: { id: order.id, status: { not: "PAID" } },
      data: { status: "PAID", paymentId: payment.id, ...(signature ? { signature } : {}) },
    });
    if (!claimed.count) return;
    await credit({
      userId: order.userId, amount: coins, type: "PURCHASE",
      description: "Coin purchase via Razorpay", idempotencyKey: `razorpay:${order.orderId}`,
    }, tx);
  });
}

import { randomUUID } from "node:crypto";
import { credit, db } from "@repo/database";
import { cashfreeMode, fetchSuccessfulPayment, findCashfreeOrder, type GatewayPayment } from "./cashfree";
import { mayRetireMissingOrder, openPaymentOrder } from "./open-payment-order";
import { sourcesOf, transitionOrder, type PaymentOrderStatus } from "./payment-order-status";

// Must match COIN_VALUE_INR in packages/api-contracts/src/wallet.ts (1 coin = ₹1).
const COIN_VALUE_INR = 1;

/** Cashfree keeps an order payable for 30 minutes (ORDER_TTL_MS in cashfree.ts). */
const REUSE_WINDOW_MS = 30 * 60_000;

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
    // Refunded, duplicate and parked orders stay where they are: Cashfree
    // keeps listing a refunded payment as SUCCESS, so this check is what stops
    // a later verify from fulfilling it again.
    if (!sourcesOf("PAID").includes(order.status as PaymentOrderStatus)) {
      throw new PaymentError(`Order is ${order.status.toLowerCase().replace("_", " ")} and cannot be fulfilled.`, 409);
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
    const claimed = await transitionOrder(tx, { id: order.id }, "PAID", { paymentId: payment.id });
    if (!claimed) return;
    // The money record admin, analytics and refunds read; amount in paise like
    // every other Payment row.
    await tx.payment.create({ data: {
      userId: order.userId, type: "COIN_PURCHASE", amount: payment.amount, status: "SUCCESS",
      gatewayOrderId: order.orderId, gatewayPaymentId: payment.id,
    } });
    await credit({
      userId: order.userId, amount: coins, type: "PURCHASE",
      description: "Coin purchase via Cashfree", idempotencyKey: `cashfree:${order.orderId}`,
    }, tx);
  });
}

/**
 * Open a Cashfree order for a coin pack. The caller resolves the pack from
 * the shared list (resolveCoinPackage), so the price never comes from the
 * browser. The receipt snapshots the coin quantity and doubles as the
 * Cashfree order id. The row is saved before Cashfree is called (#10).
 */
export async function createCoinPaymentOrder(userId: string, pack: { coins: number; priceInr: number }) {
  // At most 35 characters, so the derived refund id (rf_<orderId>) stays
  // within Cashfree's 40-character limit for any coin quantity.
  const prefix = `coins_${pack.coins}_`;
  const reused = await reuseOpenCoinOrder(userId, prefix);
  if (reused) return reused;
  const receipt = `${prefix}${randomUUID().replaceAll("-", "").slice(0, 35 - prefix.length)}`;
  const order = await openPaymentOrder({ userId, orderId: receipt, amountInr: pack.priceInr });
  return { orderId: order.orderId, paymentSessionId: order.paymentSessionId, mode: order.mode };
}

/**
 * A second click or a retry must not open a second chargeable order (#10):
 * hand back this user's open order for the same pack while Cashfree still
 * accepts payment for it. One Cashfree has expired, or has no record of, is
 * marked EXPIRED so it is not looked at again.
 */
async function reuseOpenCoinOrder(userId: string, prefix: string) {
  const open = await db.paymentOrder.findFirst({
    where: { userId, status: "CREATED", receipt: { startsWith: prefix }, createdAt: { gte: new Date(Date.now() - REUSE_WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
  });
  if (!open) return null;
  const existing = await findCashfreeOrder(open.orderId);
  if (existing?.status === "ACTIVE" && existing.paymentSessionId) {
    return { orderId: open.orderId, paymentSessionId: existing.paymentSessionId, mode: cashfreeMode() };
  }
  // A PAID order is settled by the webhook or the reconciler; buying the pack
  // again is a new purchase.
  if (existing ? existing.status !== "PAID" : mayRetireMissingOrder(open)) {
    await transitionOrder(db, { id: open.id }, "EXPIRED");
  }
  return null;
}

/**
 * Confirm a coin order with Cashfree and credit it. The browser only names
 * the order; whether it was paid, and for how much, comes from Cashfree.
 */
export async function verifyCoinPayment(userId: string, orderId: unknown) {
  if (typeof orderId !== "string" || !orderId) throw new PaymentError("Missing payment details", 400);
  const order = await db.paymentOrder.findUnique({ where: { orderId } });
  if (!order || order.userId !== userId) throw new PaymentError("Order not found", 404);
  const payment = await fetchSuccessfulPayment(order.orderId);
  if (!payment) throw new PaymentError("Payment is awaiting confirmation. Your wallet will update once confirmed.", 409);
  await settlePayment(payment, userId);
}

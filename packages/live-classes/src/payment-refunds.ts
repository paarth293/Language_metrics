/**
 * Refunds, admin-initiated only.
 *
 * Order of operations, chosen so no failure loses money silently:
 *
 *   1. Validate: only a paid order, amount 1..paid, coins still unspent.
 *   2. Claim the order as REFUND_PENDING with a guarded transition. A second
 *      or concurrent request loses here and is refused.
 *   3. Ask Cashfree, with a refund_id derived from the order, so a retried
 *      call can never refund twice. If Cashfree refuses, the claim is undone.
 *   4. Only then reverse what the student received (coins, recording unlock)
 *      and record the refund. If that step fails the money has already gone
 *      back, so it is reported for a human rather than retried blindly.
 *
 * One refund per order: the refund_id is fixed, and REFUND_PENDING / REFUNDED
 * cannot be claimed again.
 */
import { adjust, db, getSpendableBalance } from "@repo/database";
import { CashfreeError, createCashfreeRefund, type CashfreeRefundStatus } from "./cashfree";
import { reportPaymentIncident } from "./payment-incidents";
import { canTransitionOrder, transitionOrder, type PaymentOrderStatus } from "./payment-order-status";
import { recordingIdFromReceipt } from "./recording-payments";

export class RefundError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export interface RefundResult {
  orderId: string;
  refundId: string;
  amountInr: number;
  status: "REFUND_PENDING" | "REFUNDED";
}

// Must match COIN_VALUE_INR in packages/api-contracts/src/wallet.ts (1 coin = ₹1).
const COIN_VALUE_INR = 1;

/** Cashfree refund_id is ours to choose; order ids are at most 35 characters. */
export function refundIdFor(orderId: string) {
  return `rf_${orderId}`;
}

function coinsCredited(order: { receipt: string | null; amount: number }) {
  const saved = /^coins_(\d+)_/.exec(order.receipt ?? "")?.[1];
  return saved ? Number(saved) : order.amount / COIN_VALUE_INR;
}

export async function refundPaymentOrder(input: { orderId: string; amountInr?: number; reason: string; requestedBy: string }): Promise<RefundResult> {
  const order = await db.paymentOrder.findUnique({ where: { orderId: input.orderId } });
  if (!order) throw new RefundError("Order not found", 404);
  const previous = order.status as PaymentOrderStatus;
  if (previous === "REFUND_PENDING" || previous === "REFUNDED") throw new RefundError("This order has already been refunded.", 409);
  if (!canTransitionOrder(previous, "REFUND_PENDING")) throw new RefundError("Only paid orders can be refunded.", 409);

  const amountInr = input.amountInr ?? order.amount;
  if (!Number.isInteger(amountInr) || amountInr < 1 || amountInr > order.amount) {
    throw new RefundError(`Refund must be a whole amount between ₹1 and the ₹${order.amount} paid.`, 400);
  }
  const full = amountInr === order.amount;
  const isCoins = order.receipt?.startsWith("coins_") ?? false;
  const isRecording = order.receipt?.startsWith("rec_") ?? false;
  // Only a PAID order was fulfilled; DUPLICATE and NEEDS_REVIEW gave nothing.
  const coinsToRemove = previous === "PAID" && isCoins ? Math.round((coinsCredited(order) * amountInr) / order.amount) : 0;
  if (coinsToRemove > 0 && (await getSpendableBalance(order.userId)) < coinsToRemove) {
    throw new RefundError("The student has already spent these coins, so they cannot be refunded automatically.", 409);
  }

  if (!(await transitionOrder(db, { id: order.id }, "REFUND_PENDING", {}, [previous]))) {
    throw new RefundError("A refund for this order is already in progress.", 409);
  }

  const refundId = refundIdFor(order.orderId);
  let refundStatus: CashfreeRefundStatus;
  try {
    ({ status: refundStatus } = await createCashfreeRefund({ orderId: order.orderId, refundId, amountInr, note: input.reason }));
  } catch (error) {
    await transitionOrder(db, { id: order.id }, previous, {}, ["REFUND_PENDING"]);
    if (error instanceof CashfreeError) throw new RefundError(error.message, error.status);
    throw error;
  }

  try {
    await db.$transaction(async (tx) => {
      if (coinsToRemove > 0) {
        await adjust({
          userId: order.userId, delta: -coinsToRemove, idempotencyKey: `cashfree-refund:${refundId}`,
          description: `Refund of ₹${amountInr} for coin purchase ${order.orderId}`,
        }, tx);
      }
      const recordingId = isRecording && previous === "PAID" && full ? recordingIdFromReceipt(order.receipt) : null;
      if (recordingId) await tx.classSession.updateMany({ where: { id: recordingId, isRecordingPaid: true }, data: { isRecordingPaid: false } });
      if (full) await tx.payment.updateMany({ where: { gatewayOrderId: order.orderId, status: "SUCCESS" }, data: { status: "REFUNDED" } });
      await tx.payment.create({ data: {
        userId: order.userId, type: isRecording ? "RECORDING_FEE" : "COIN_PURCHASE", amount: amountInr * 100,
        status: refundStatus === "SUCCESS" ? "REFUNDED" : "PENDING", gatewayPaymentId: `refund:${refundId}`,
      } });
    });
  } catch (error) {
    await reportPaymentIncident({
      kind: "refund_reversal_failed", orderId: order.orderId, refundId, amountInr, requestedBy: input.requestedBy,
      reason: `Cashfree accepted the refund but reversing the purchase failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }

  if (refundStatus === "SUCCESS") await completeRefund(order.orderId, refundId);
  return { orderId: order.orderId, refundId, amountInr, status: refundStatus === "SUCCESS" ? "REFUNDED" : "REFUND_PENDING" };
}

/** Cashfree confirmed one of our refunds (webhook or reconciliation). */
export async function completeRefund(orderId: string, refundId = refundIdFor(orderId)): Promise<boolean> {
  const moved = await transitionOrder(db, { orderId }, "REFUNDED", {}, ["REFUND_PENDING"]);
  await db.payment.updateMany({ where: { gatewayPaymentId: `refund:${refundId}` }, data: { status: "REFUNDED" } });
  return moved > 0;
}

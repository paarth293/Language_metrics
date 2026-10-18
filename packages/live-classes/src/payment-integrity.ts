/**
 * Read-only consistency checks between payment orders, the coin ledger,
 * recording unlocks and Payment rows. Every list should be empty; anything in
 * one is money that was taken without delivery or delivered without payment.
 *
 * Fulfilment is judged from the ledger and the unlock flag, not from Payment
 * rows, so orders from before coin purchases wrote Payment rows still check.
 * The same checks exist as SQL in tests/payment-security/payment-integrity.sql.
 */
import { db, type Tx } from "@repo/database";
import { recordingIdFromReceipt } from "./recording-payments";

const PENDING_LIMIT_MS = 30 * 60_000;
/** Orders that were paid; a refund keeps the original credit row. */
const PAID_STATES = ["PAID", "REFUND_PENDING", "REFUNDED"];

export interface PaymentIntegrityProblems {
  paidNotFulfilled: string[];
  fulfilledNotPaid: string[];
  duplicatePaymentIds: string[];
  pendingTooLong: string[];
}

function duplicates(values: Array<string | null>) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  }
  return [...repeated];
}

export async function findPaymentIntegrityProblems(client: Tx = db, now: Date = new Date()): Promise<PaymentIntegrityProblems> {
  const paid = await client.paymentOrder.findMany({ where: { status: "PAID" } });

  const coinOrders = paid.filter((o) => o.receipt?.startsWith("coins_"));
  const credited = new Set(
    (await client.coinTransaction.findMany({
      where: { idempotencyKey: { in: coinOrders.flatMap((o) => [`cashfree:${o.orderId}`, `razorpay:${o.orderId}`]) } },
      select: { idempotencyKey: true },
    })).map((t) => t.idempotencyKey?.replace(/^(cashfree|razorpay):/, "")),
  );
  const recordingOrders = paid.map((o) => ({ orderId: o.orderId, sessionId: recordingIdFromReceipt(o.receipt) })).filter((o) => o.sessionId);
  const unlocked = new Set(
    (await client.classSession.findMany({
      where: { id: { in: recordingOrders.map((o) => o.sessionId!) }, isRecordingPaid: true },
      select: { id: true },
    })).map((s) => s.id),
  );
  const paidNotFulfilled = [
    ...coinOrders.filter((o) => !credited.has(o.orderId)).map((o) => o.orderId),
    ...recordingOrders.filter((o) => !unlocked.has(o.sessionId!)).map((o) => o.orderId),
  ];

  const creditKeys = await client.coinTransaction.findMany({ where: { idempotencyKey: { startsWith: "cashfree:" } }, select: { idempotencyKey: true } });
  const successPayments = await client.payment.findMany({ where: { status: "SUCCESS", gatewayOrderId: { not: null } }, select: { gatewayOrderId: true } });
  const fulfilledIds = [...new Set([
    ...creditKeys.map((t) => t.idempotencyKey!.slice("cashfree:".length)),
    ...successPayments.map((p) => p.gatewayOrderId!),
  ])];
  const fulfilledOrders = await client.paymentOrder.findMany({ where: { orderId: { in: fulfilledIds } }, select: { orderId: true, status: true } });
  const fulfilledNotPaid = fulfilledOrders.filter((o) => !PAID_STATES.includes(o.status)).map((o) => o.orderId);

  const orderPaymentIds = await client.paymentOrder.findMany({ where: { paymentId: { not: null } }, select: { paymentId: true } });
  const rowPaymentIds = await client.payment.findMany({ where: { gatewayPaymentId: { not: null } }, select: { gatewayPaymentId: true } });
  const duplicatePaymentIds = [...new Set([
    ...duplicates(orderPaymentIds.map((o) => o.paymentId)),
    ...duplicates(rowPaymentIds.map((p) => p.gatewayPaymentId)),
  ])];

  const pending = await client.paymentOrder.findMany({
    where: { status: { in: ["CREATED", "FAILED"] }, createdAt: { lt: new Date(now.getTime() - PENDING_LIMIT_MS) } },
    select: { orderId: true },
  });

  return { paidNotFulfilled, fulfilledNotPaid, duplicatePaymentIds, pendingTooLong: pending.map((o) => o.orderId) };
}

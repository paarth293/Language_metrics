/**
 * Safety net for payments whose confirmation never arrived.
 *
 * Checkout confirms a payment only while the student's tab is open, and the
 * webhook can be missed, misconfigured or rejected. Either way Cashfree has
 * the money and we have an order stuck at CREATED. This sweep asks Cashfree
 * about every unconfirmed order in a window and settles it through the same
 * idempotent functions checkout and the webhook use, so a payment confirmed
 * by all three is still fulfilled once.
 */
import { db } from "@repo/database";
import { fetchCashfreeOrder, fetchSuccessfulPayment, type GatewayPayment } from "./cashfree";
import { settlePayment } from "./coin-payments";
import { flagPaymentForReview, isPermanentPaymentError } from "./payment-incidents";
import { settleRecordingPayment } from "./recording-payments";

/** Leave orders this young alone: the student is probably still paying. */
const MIN_AGE_MS = 10 * 60_000;
/** Cashfree orders expire well before this; older rows are only reported. */
const MAX_AGE_MS = 72 * 60 * 60_000;
/** Unpaid and older than this is worth a human look. */
const STUCK_AFTER_MS = 60 * 60_000;
const BATCH_SIZE = 50;

export interface PaymentReconciliationSummary {
  checked: number;
  settled: string[];
  /** Paid but unsettleable; parked at NEEDS_REVIEW. */
  flagged: string[];
  expired: string[];
  stuck: string[];
  failed: Array<{ orderId: string; error: string }>;
}

/** Order ids are our receipts, so the prefix says which flow owns the payment. */
export async function settleGatewayPayment(payment: GatewayPayment) {
  if (payment.order_id.startsWith("rec_")) await settleRecordingPayment(payment);
  else await settlePayment(payment);
}

export async function reconcilePaymentOrders(now: Date = new Date()): Promise<PaymentReconciliationSummary> {
  const summary: PaymentReconciliationSummary = { checked: 0, settled: [], flagged: [], expired: [], stuck: [], failed: [] };
  const orders = await db.paymentOrder.findMany({
    where: {
      status: "CREATED",
      createdAt: { lte: new Date(now.getTime() - MIN_AGE_MS), gte: new Date(now.getTime() - MAX_AGE_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: BATCH_SIZE,
  });

  for (const order of orders) {
    summary.checked++;
    try {
      const payment = await fetchSuccessfulPayment(order.orderId);
      if (payment) {
        try {
          await settleGatewayPayment(payment);
          summary.settled.push(order.orderId);
        } catch (error) {
          if (!isPermanentPaymentError(error)) throw error;
          await flagPaymentForReview(payment, error.message);
          summary.flagged.push(order.orderId);
        }
        continue;
      }
      const { status } = await fetchCashfreeOrder(order.orderId);
      if (status === "EXPIRED" || status === "TERMINATED") {
        // Conditional so a payment settled meanwhile is never overwritten.
        const expired = await db.paymentOrder.updateMany({ where: { id: order.id, status: "CREATED" }, data: { status: "EXPIRED" } });
        if (expired.count) summary.expired.push(order.orderId);
        continue;
      }
      if (now.getTime() - order.createdAt.getTime() > STUCK_AFTER_MS) summary.stuck.push(order.orderId);
    } catch (error) {
      summary.failed.push({ orderId: order.orderId, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return summary;
}

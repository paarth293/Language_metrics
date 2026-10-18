/**
 * Payments that took the student's money but cannot be fulfilled.
 *
 * A settlement error with a 4xx status is permanent: the payment does not
 * match its order, or the order does not exist. Retrying cannot fix it, so
 * instead of bouncing it back to Cashfree (which retries a few times and then
 * drops it) the order is parked at NEEDS_REVIEW, out of every automatic flow,
 * and a human is told.
 */
import { db } from "@repo/database";
import type { GatewayPayment } from "./cashfree";
import { transitionOrder } from "./payment-order-status";

export interface PaymentIncident {
  kind: "unsettleable_payment" | "duplicate_payment" | "stuck_orders" | "reconciliation_failed" | "refund_processed" | "refund_failed" | "dispute";
  orderId?: string;
  paymentId?: string;
  reason: string;
  [detail: string]: unknown;
}

/** Errors from settlement whose status says retrying will not help. */
export function isPermanentPaymentError(error: unknown): error is Error & { status: number } {
  const status = (error as { status?: unknown } | null)?.status;
  return error instanceof Error && typeof status === "number" && status >= 400 && status < 500;
}

export async function reportPaymentIncident(incident: PaymentIncident): Promise<void> {
  console.error("[payment-incident]", incident);
}

/** Park the order for a human and report it. Never overwrites a fulfilled order. */
export async function flagPaymentForReview(payment: GatewayPayment, reason: string): Promise<void> {
  await transitionOrder(db, { orderId: payment.order_id }, "NEEDS_REVIEW", { paymentId: payment.id });
  await reportPaymentIncident({
    kind: "unsettleable_payment", orderId: payment.order_id, paymentId: payment.id, reason,
    amountPaise: payment.amount, currency: payment.currency,
  });
}

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
  kind: "unsettleable_payment" | "duplicate_payment" | "stuck_orders" | "reconciliation_failed" | "refund_processed" | "refund_failed" | "refund_reversal_failed" | "dispute";
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

const ALERT_TIMEOUT_MS = 5_000;

/**
 * Log the incident and, when PAYMENT_ALERT_WEBHOOK_URL is set, POST it there.
 * The body carries `text` (Slack) and `content` (Discord) plus the raw
 * incident. Delivery is best-effort: a broken alert endpoint must never fail
 * the payment flow that raised the alert, so errors are logged and swallowed.
 */
export async function reportPaymentIncident(incident: PaymentIncident): Promise<void> {
  console.error("[payment-incident]", incident);
  const url = process.env.PAYMENT_ALERT_WEBHOOK_URL;
  if (!url) return;
  const ids = [incident.orderId && `order ${incident.orderId}`, incident.paymentId && `payment ${incident.paymentId}`].filter(Boolean).join(", ");
  const text = `Payment incident: ${incident.kind}${ids ? ` (${ids})` : ""}. ${incident.reason}`;
  try {
    const response = await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, content: text, incident }),
      signal: AbortSignal.timeout(ALERT_TIMEOUT_MS),
    });
    if (!response.ok) console.error("[payment-incident] alert delivery failed with HTTP", response.status);
  } catch (error) {
    console.error("[payment-incident] alert delivery failed:", error instanceof Error ? error.message : error);
  }
}

/** Park the order for a human and report it. Never overwrites a fulfilled order. */
export async function flagPaymentForReview(payment: GatewayPayment, reason: string): Promise<void> {
  await transitionOrder(db, { orderId: payment.order_id }, "NEEDS_REVIEW", { paymentId: payment.id });
  await reportPaymentIncident({
    kind: "unsettleable_payment", orderId: payment.order_id, paymentId: payment.id, reason,
    amountPaise: payment.amount, currency: payment.currency,
  });
}

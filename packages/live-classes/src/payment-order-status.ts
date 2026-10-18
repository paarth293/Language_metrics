/**
 * The life of a payment order, in one table.
 *
 * Every status change goes through transitionOrder(), a single conditional
 * UPDATE whose WHERE clause lists the statuses allowed to move to the target.
 * A blocked move writes nothing, so a late, duplicate or out-of-order event can
 * never drag an order backwards, and a refunded order can never be paid again.
 *
 * The database enforces the same value list with a CHECK constraint
 * (migration *_payment_order_status_check). The column stays TEXT in Prisma so
 * the client works both before and after that migration is applied.
 */
import type { Tx } from "@repo/database";

export const PAYMENT_ORDER_STATUSES = [
  "CREATED",        // order opened with Cashfree, nothing paid yet
  "FAILED",         // last attempt failed or was abandoned; still payable
  "EXPIRED",        // Cashfree expired it unpaid
  "PAID",           // paid and fulfilled
  "DUPLICATE",      // paid, but the purchase was already fulfilled by another order; refund due
  "NEEDS_REVIEW",   // paid, but cannot be fulfilled automatically
  "REFUND_PENDING", // refund requested from Cashfree
  "REFUNDED",       // refund completed (terminal)
] as const;

export type PaymentOrderStatus = (typeof PAYMENT_ORDER_STATUSES)[number];

const TRANSITIONS: Record<PaymentOrderStatus, readonly PaymentOrderStatus[]> = {
  CREATED: ["FAILED", "EXPIRED", "PAID", "NEEDS_REVIEW"],
  FAILED: ["EXPIRED", "PAID", "NEEDS_REVIEW"],
  // Money that arrives after expiry is still real, so it is still honoured.
  EXPIRED: ["PAID", "NEEDS_REVIEW"],
  // PAID -> DUPLICATE: settlement claimed the order, then found the recording
  // already unlocked by another order.
  PAID: ["DUPLICATE", "REFUND_PENDING", "REFUNDED"],
  DUPLICATE: ["REFUND_PENDING", "REFUNDED"],
  NEEDS_REVIEW: ["REFUND_PENDING", "REFUNDED"],
  // A cancelled refund returns the order to what it was; see refundSources.
  REFUND_PENDING: ["REFUNDED", "PAID", "DUPLICATE", "NEEDS_REVIEW"],
  REFUNDED: [],
};

export function canTransitionOrder(from: PaymentOrderStatus, to: PaymentOrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

/** Every status allowed to move to `to`. */
export function sourcesOf(to: PaymentOrderStatus): PaymentOrderStatus[] {
  return PAYMENT_ORDER_STATUSES.filter((from) => canTransitionOrder(from, to));
}

/**
 * Move the order to `to` if, at write time, its status allows it. Returns the
 * number of rows changed: 0 means the move was blocked or lost a race.
 */
export async function transitionOrder(
  client: Tx,
  where: { id: string } | { orderId: string },
  to: PaymentOrderStatus,
  data: { paymentId?: string } = {},
  from: readonly PaymentOrderStatus[] = sourcesOf(to),
): Promise<number> {
  const allowed = from.filter((status) => canTransitionOrder(status, to));
  if (!allowed.length) return 0;
  const result = await client.paymentOrder.updateMany({ where: { ...where, status: { in: allowed } }, data: { ...data, status: to } });
  return result.count;
}

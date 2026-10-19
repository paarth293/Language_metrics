/**
 * Open a payment order: our row first, then Cashfree (#10).
 *
 * Before, Cashfree was called first. If the row insert then failed (pool
 * exhausted, timeout, crash), Cashfree held a payable order we had no record
 * of. Now the row is saved CREATED first, so a failed insert means Cashfree is
 * never called. A failed Cashfree call marks the row FAILED and rethrows.
 *
 * A row can still be left without a Cashfree order (a crash between the two
 * steps, or the FAILED update failing too). The reconciler expires such rows
 * when Cashfree answers 404 for them.
 */
import { db } from "@repo/database";
import { log } from "@repo/logger";
import { createCashfreeOrder } from "./cashfree";
import { transitionOrder } from "./payment-order-status";

export async function openPaymentOrder(input: { userId: string; orderId: string; amountInr: number }) {
  const { userId, orderId, amountInr } = input;
  // The order id is our receipt, so webhooks can be routed by its prefix.
  await db.paymentOrder.create({ data: { userId, orderId, amount: amountInr, currency: "INR", receipt: orderId, status: "CREATED" } });
  try {
    return await createCashfreeOrder({ orderId, amountInr, customerId: userId });
  } catch (error) {
    try {
      await transitionOrder(db, { orderId }, "FAILED", {}, ["CREATED"]);
    } catch (updateError) {
      // The row stays CREATED; the reconciler expires it once Cashfree says 404.
      log.error("could not mark payment order FAILED", { orderId, error: updateError });
    }
    throw error;
  }
}

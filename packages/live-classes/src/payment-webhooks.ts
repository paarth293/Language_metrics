/**
 * What each verified Cashfree webhook does to our records.
 *
 * Every write is conditional on the order's current status, so events can
 * arrive late, twice or out of order without moving an order backwards: a
 * failure event never touches a PAID order, and a refund only applies to an
 * order that was actually paid.
 */
import { db } from "@repo/database";
import { parseCashfreeWebhook } from "./cashfree";
import { flagPaymentForReview, isPermanentPaymentError, reportPaymentIncident } from "./payment-incidents";
import { settleGatewayPayment } from "./payment-reconciliation";

export async function handleCashfreeWebhook(payload: unknown): Promise<{ flagged?: boolean }> {
  const event = parseCashfreeWebhook(payload);

  switch (event.kind) {
    case "payment_success": {
      try {
        await settleGatewayPayment(event.payment);
      } catch (error) {
        // Cashfree has the money; bouncing a permanent failure would make it
        // give up and the payment would vanish. Keep it for a human instead.
        if (!isPermanentPaymentError(error)) throw error;
        await flagPaymentForReview(event.payment, error.message);
        return { flagged: true };
      }
      return {};
    }

    case "payment_failed": {
      // The order stays payable: a retry on the same order can still succeed.
      await db.paymentOrder.updateMany({ where: { orderId: event.payment.order_id, status: "CREATED" }, data: { status: "FAILED" } });
      return {};
    }

    case "refund": {
      if (event.status === "SUCCESS") {
        await db.paymentOrder.updateMany({
          where: { orderId: event.orderId, status: { in: ["PAID", "DUPLICATE", "NEEDS_REVIEW", "REFUND_PENDING"] } },
          data: { status: "REFUNDED" },
        });
        await reportPaymentIncident({
          kind: "refund_processed", orderId: event.orderId, refundId: event.refundId, amountInr: event.amountInr,
          reason: "Cashfree refunded this order; reverse the coins or recording unlock if that was not already done.",
        });
      } else if (event.status === "CANCELLED") {
        await reportPaymentIncident({
          kind: "refund_failed", orderId: event.orderId, refundId: event.refundId, amountInr: event.amountInr,
          reason: "Cashfree cancelled this refund after failing to pay the customer back.",
        });
      }
      return {};
    }

    case "dispute": {
      await reportPaymentIncident({
        kind: "dispute", event: event.type, orderId: event.orderId ?? undefined, disputeId: event.disputeId,
        disputeType: event.disputeType, amountInr: event.amountInr, disputeStatus: event.status, respondBy: event.respondBy,
        reason: "Respond in the Cashfree dashboard before the respond-by date.",
      });
      return {};
    }

    case "ignored":
      return {};
  }
}

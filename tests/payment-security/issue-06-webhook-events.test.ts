import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { reconcilePaymentOrders } = await import("@repo/live-classes");

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => { harness.reset(); errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { harness.teardown(); errors.mockRestore(); });

const incidents = () => errors.mock.calls.filter(([tag]) => tag === "[payment-incident]").map(([, detail]) => detail as Record<string, unknown>);
const statusOf = async (orderId: string) => (await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status;
const send = (body: unknown) => webhook(harness.cashfree.webhookRequest(body));

async function coinOrder() {
  return (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
}
const paymentEvent = (type: string, orderId: string, payment: { cf_payment_id: number; payment_status: string; payment_amount: number; payment_currency: string }) =>
  ({ type, event_time: new Date().toISOString(), data: { order: { order_id: orderId }, payment } });

describe("issue #6: failed, refund and dispute webhooks are handled", () => {
  it.each(["PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"])("%s marks the order FAILED and credits nothing", async (type) => {
    const orderId = await coinOrder();
    const attempt = harness.cashfree.pay(orderId, type === "PAYMENT_FAILED_WEBHOOK" ? "FAILED" : "USER_DROPPED");
    expect((await send(paymentEvent(type, orderId, attempt))).status).toBe(200);
    expect(await statusOf(orderId)).toBe("FAILED");
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("a successful retry on a FAILED order is still credited", async () => {
    const orderId = await coinOrder();
    await send(paymentEvent("PAYMENT_FAILED_WEBHOOK", orderId, harness.cashfree.pay(orderId, "FAILED")));
    harness.cashfree.pay(orderId, "SUCCESS");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(200);
    expect(await statusOf(orderId)).toBe("PAID");
    expect(harness.db.balances.get("student-a")).toBe(100);
  });

  it("a failure event arriving after the success (out of order) never downgrades a PAID order", async () => {
    const orderId = await coinOrder();
    const failed = harness.cashfree.pay(orderId, "FAILED");
    harness.cashfree.pay(orderId, "SUCCESS");
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    await send(paymentEvent("PAYMENT_FAILED_WEBHOOK", orderId, failed));
    expect(await statusOf(orderId)).toBe("PAID");
  });

  it("reconciliation also rescues a FAILED order that later succeeded with the webhook missed", async () => {
    const orderId = await coinOrder();
    await send(paymentEvent("PAYMENT_FAILED_WEBHOOK", orderId, harness.cashfree.pay(orderId, "FAILED")));
    harness.cashfree.pay(orderId, "SUCCESS");
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - 20 * 60_000) } });
    expect((await reconcilePaymentOrders()).settled).toEqual([orderId]);
    expect(harness.db.balances.get("student-a")).toBe(100);
  });

  it("a successful refund marks the order REFUNDED and reports it so fulfilment can be reversed", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    const refund = { type: "REFUND_STATUS_WEBHOOK", data: { refund: { order_id: orderId, refund_id: "rf_manual_1", cf_refund_id: "1", refund_amount: 100, refund_currency: "INR", refund_status: "SUCCESS" } } };
    expect((await send(refund)).status).toBe(200);
    expect(await statusOf(orderId)).toBe("REFUNDED");
    expect(incidents()).toContainEqual(expect.objectContaining({ kind: "refund_processed", orderId, refundId: "rf_manual_1" }));
  });

  it("a cancelled refund is reported and leaves the order PAID", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    await send({ type: "REFUND_STATUS_WEBHOOK", data: { refund: { order_id: orderId, refund_id: "rf_x", refund_amount: 100, refund_status: "CANCELLED" } } });
    expect(await statusOf(orderId)).toBe("PAID");
    expect(incidents()).toContainEqual(expect.objectContaining({ kind: "refund_failed", orderId, refundId: "rf_x" }));
  });

  it.each(["DISPUTE_CREATED", "DISPUTE_UPDATED", "DISPUTE_CLOSED"])("%s is reported with what a human needs to respond", async (type) => {
    const orderId = await coinOrder();
    const dispute = { type, event_time: new Date().toISOString(), data: {
      dispute: { dispute_id: "433475257", dispute_type: "CHARGEBACK", reason_code: "R1", dispute_amount: 100, dispute_status: "DISPUTE_CREATED", respond_by: "2026-11-01T00:00:00+05:30" },
      order_details: { order_id: orderId, order_amount: 100, order_currency: "INR" },
    } };
    expect((await send(dispute)).status).toBe(200);
    expect(incidents()).toContainEqual(expect.objectContaining({ kind: "dispute", event: type, orderId, disputeId: "433475257", respondBy: "2026-11-01T00:00:00+05:30" }));
  });

  it("other event types are acknowledged without side effects", async () => {
    const orderId = await coinOrder();
    expect((await send({ type: "PAYMENT_CHARGES_WEBHOOK", data: { order: { order_id: orderId } } })).status).toBe(200);
    expect(await statusOf(orderId)).toBe("CREATED");
  });
});

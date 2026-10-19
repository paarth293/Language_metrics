import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ALERT_URL, harness, jsonRequest, loggedIncidents } from "./harness/setup";
import { TEST_SECRET } from "./harness/fake-cashfree";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: verifyRecording } = await import("@/app/api/students/payments/cashfree/verify/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { reconcilePaymentOrders } = await import("@repo/live-classes");

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  harness.reset();
  vi.stubEnv("PAYMENT_ALERT_WEBHOOK_URL", ALERT_URL);
  errors = vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { harness.teardown(); errors.mockRestore(); });

async function coinOrder() {
  return (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
}
async function mismatchedWebhook() {
  const orderId = await coinOrder();
  const event = harness.cashfree.successWebhook(orderId, { cf_payment_id: 91, payment_amount: 1, payment_currency: "INR", payment_status: "SUCCESS" });
  return { orderId, response: await webhook(harness.cashfree.webhookRequest(event)) };
}

describe("issue #12: payment incidents raise alerts", () => {
  it("an unsettleable payment is POSTed to PAYMENT_ALERT_WEBHOOK_URL in a chat-webhook format", async () => {
    const { orderId } = await mismatchedWebhook();
    expect(harness.alerts).toHaveLength(1);
    const { body } = harness.alerts[0]!;
    expect(body.text).toEqual(expect.stringContaining("unsettleable_payment"));
    expect(body.text).toEqual(expect.stringContaining(orderId));
    expect(body.content).toBe(body.text);
    expect(body.incident).toMatchObject({ kind: "unsettleable_payment", orderId });
  });

  it("alerts never carry secrets", async () => {
    await mismatchedWebhook();
    expect(JSON.stringify(harness.alerts)).not.toContain(TEST_SECRET);
  });

  it.each([[500], [0]])("a broken alert endpoint (status %s) never breaks payment handling", async (status) => {
    harness.alertEndpointReturns(status);
    const { orderId, response } = await mismatchedWebhook();
    expect(response.status).toBe(200);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("NEEDS_REVIEW");
  });

  it("without the env var, incidents are only logged", async () => {
    vi.stubEnv("PAYMENT_ALERT_WEBHOOK_URL", "");
    await mismatchedWebhook();
    expect(harness.alerts).toHaveLength(0);
    expect(loggedIncidents(errors).length > 0).toBe(true);
  });

  it("a duplicate recording payment raises a duplicate_payment alert", async () => {
    const recording = "77777777-7777-4777-8777-777777777777";
    await harness.db.db.classSession.create({ data: { id: recording, bookingId: "b", booking: { studentId: "student-a" }, isRecordingPaid: true } });
    const orderId = `rec_${Buffer.from(recording.replaceAll("-", ""), "hex").toString("base64url")}_dddddddd`;
    await harness.cashfree.fetch("https://sandbox.cashfree.com/pg/orders", { method: "POST", headers: { "x-client-secret": TEST_SECRET }, body: JSON.stringify({ order_id: orderId, order_amount: 299, order_currency: "INR", customer_details: {} }) });
    await harness.db.db.paymentOrder.create({ data: { orderId, receipt: orderId, userId: "student-a", amount: 299 } });
    harness.cashfree.pay(orderId, "SUCCESS");

    await verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId }));
    expect(harness.alerts.map((a) => (a.body.incident as { kind: string }).kind)).toContain("duplicate_payment");
  });

  it("reconciliation raises one stuck_orders alert listing the orders that just became stuck", async () => {
    const a = await coinOrder();
    const b = await coinOrder();
    await harness.db.db.paymentOrder.updateMany({ where: { orderId: { in: [a, b] } }, data: { createdAt: new Date(Date.now() - 70 * 60_000) } });
    await reconcilePaymentOrders();
    const stuck = harness.alerts.filter((x) => (x.body.incident as { kind: string }).kind === "stuck_orders");
    expect(stuck).toHaveLength(1);
    expect((stuck[0]!.body.incident as { orderIds: string[] }).orderIds.sort()).toEqual([a, b].sort());
  });

  it("an order already reported as stuck is not re-alerted on every later sweep", async () => {
    const a = await coinOrder();
    await harness.db.db.paymentOrder.updateMany({ where: { orderId: a }, data: { createdAt: new Date(Date.now() - 5 * 60 * 60_000) } });
    const summary = await reconcilePaymentOrders();
    expect(summary.stuck).toEqual([a]);
    expect(harness.alerts.filter((x) => (x.body.incident as { kind: string }).kind === "stuck_orders")).toHaveLength(0);
  });

  it("new Cashfree orders expire after 30 minutes, so abandoned checkouts do not linger as stuck", async () => {
    const before = Date.now();
    await coinOrder();
    const sent = harness.cashfree.lastOrderBody();
    const expiry = Date.parse(String(sent.order_expiry_time));
    expect(expiry - before).toBeGreaterThanOrEqual(29 * 60_000);
    expect(expiry - before).toBeLessThanOrEqual(31 * 60_000);
  });
});

describe("issue #12: a cancelled refund found by reconciliation alerts once", () => {
  it("two sweeps over a cancelled refund raise exactly one refund_failed alert", async () => {
    const { refundPaymentOrder } = await import("@repo/live-classes");
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    await refundPaymentOrder({ orderId, reason: "test refund", requestedBy: "admin" });
    harness.cashfree.settleRefund(orderId, `rf_${orderId}`, "CANCELLED");

    const later = new Date(Date.now() + 20 * 60_000);
    await reconcilePaymentOrders(later);
    await reconcilePaymentOrders(later);
    expect(harness.alerts.filter((x) => (x.body.incident as { kind: string }).kind === "refund_failed")).toHaveLength(1);
  });
});

describe("issue #12: transient gateway failures are retried once", () => {
  it("verify succeeds when the first Cashfree lookup returns 503", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    harness.cashfree.failNext(503);
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(100);
  });

  it("gives up after one retry and reports the gateway as unavailable", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    harness.cashfree.failNext(503, 503);
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(502);
  });

  it("does not retry order creation, which is not idempotent", async () => {
    harness.cashfree.failNext(503);
    expect((await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).status).toBe(502);
    expect(harness.cashfree.calls.filter((c) => c.method === "POST" && c.path === "/orders")).toHaveLength(1);
  });
});

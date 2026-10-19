import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest, loggedIncidents } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { reconcilePaymentOrders } = await import("@repo/live-classes");

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => { harness.reset(); errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { harness.teardown(); errors.mockRestore(); });

const incidents = () => loggedIncidents(errors);

async function coinOrder() {
  return (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
}

describe("issue #5: paid but unsettleable webhooks are kept, not dropped", () => {
  it("a signed success that does not match the order is flagged NEEDS_REVIEW, reported, and acknowledged with 200", async () => {
    const orderId = await coinOrder();
    const event = harness.cashfree.successWebhook(orderId, { cf_payment_id: 77, payment_amount: 1, payment_currency: "INR", payment_status: "SUCCESS" });
    const response = await webhook(harness.cashfree.webhookRequest(event));

    expect(response.status).toBe(200);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("NEEDS_REVIEW");
    expect(incidents()).toEqual([expect.objectContaining({ kind: "unsettleable_payment", orderId, paymentId: "77" })]);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("a signed success for an order we never created is reported and acknowledged", async () => {
    const event = harness.cashfree.successWebhook("coins_100_unknown", { cf_payment_id: 78, payment_amount: 100, payment_currency: "INR", payment_status: "SUCCESS" });
    expect((await webhook(harness.cashfree.webhookRequest(event))).status).toBe(200);
    expect(incidents()).toEqual([expect.objectContaining({ kind: "unsettleable_payment", orderId: "coins_100_unknown" })]);
  });

  it("a transient failure (database down) still returns 5xx so Cashfree retries", async () => {
    const orderId = await coinOrder();
    const payment = harness.cashfree.pay(orderId, "SUCCESS");
    vi.spyOn(harness.db.db, "$transaction").mockRejectedValueOnce(new Error("connection refused"));
    expect((await webhook(harness.cashfree.webhookRequest(harness.cashfree.successWebhook(orderId, payment)))).status).toBe(500);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("CREATED");
  });

  it("reconciliation flags a permanently unsettleable order instead of retrying it forever", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS", "upi", 1);
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - 20 * 60_000) } });

    await reconcilePaymentOrders();
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("NEEDS_REVIEW");
    harness.cashfree.calls.length = 0;
    await reconcilePaymentOrders();
    expect(harness.cashfree.calls).toHaveLength(0);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

async function paidCoinOrder(packageId = "tier2") {
  const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId }))).json()).orderId as string;
  return { orderId, payment: harness.cashfree.pay(orderId, "SUCCESS") };
}

describe("issue #7: coin purchases are recorded as Payment rows", () => {
  it("a settled coin purchase writes one SUCCESS Payment the admin payments page can list", async () => {
    const { orderId, payment } = await paidCoinOrder();
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));

    const rows = await harness.db.db.payment.findMany({ where: { type: "COIN_PURCHASE" } });
    expect(rows).toEqual([expect.objectContaining({
      userId: "student-a", type: "COIN_PURCHASE", status: "SUCCESS", bookingId: null,
      amount: 50000, // paise, as the admin page divides by 100
      gatewayOrderId: orderId, gatewayPaymentId: String(payment.cf_payment_id),
    })]);
  });

  it("checkout, webhook and 20 retries together still write exactly one Payment", async () => {
    const { orderId, payment } = await paidCoinOrder();
    await Promise.all([
      webhook(harness.cashfree.webhookRequest(harness.cashfree.successWebhook(orderId, payment))),
      ...Array.from({ length: 21 }, () => verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))),
    ]);
    expect(await harness.db.db.payment.count({ where: { type: "COIN_PURCHASE" } })).toBe(1);
  });

  it("an unpaid order writes no Payment", async () => {
    const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId;
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    expect(await harness.db.db.payment.count()).toBe(0);
  });
});

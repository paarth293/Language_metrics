import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

async function openOrder() {
  const response = await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }));
  return (await response.json()).orderId as string;
}

/**
 * Cashfree's modal checkout returns no signature to the browser, so a "fake
 * success callback" is any verify call the gateway does not back up. The
 * server must believe Cashfree, never the request body.
 */
describe("2. fake success callback", () => {
  it("rejects a forged callback with a made-up signature when Cashfree has no successful payment", async () => {
    const orderId = await openOrder();
    const forged = { orderId, payment_status: "SUCCESS", cf_payment_id: 1, signature: "Zm9yZ2Vk", amount: 100 };
    const response = await verifyPayment(jsonRequest("/api/payments/verify-payment", forged));
    expect(response.status).toBe(409);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).not.toBe("PAID");
  });

  it("rejects a callback when the only Cashfree payment failed", async () => {
    const orderId = await openOrder();
    harness.cashfree.pay(orderId, "FAILED");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(409);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("rejects a success for less money than the order", async () => {
    const orderId = await openOrder();
    harness.cashfree.pay(orderId, "SUCCESS", "upi", 1);
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(400);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("credits exactly the pack once Cashfree confirms", async () => {
    const orderId = await openOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId, coins: 5000 }))).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(100);
  });
});

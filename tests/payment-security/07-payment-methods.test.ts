import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { reconcilePaymentOrders } = await import("@repo/live-classes");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

/**
 * What the server does for each payment method and outcome, as Cashfree
 * reports them (payment_group / payment_status). The hosted checkout handles
 * 3-D Secure, UPI PIN and bank pages; the server only ever sees these states.
 *
 * Sandbox data for a manual run (Cashfree "data to test integration"):
 *   UPI: testsuccess@gocash (success), testfailure@gocash (failure),
 *        testuserdropped@gocash (abandoned), testexpired@gocash (timeout)
 *   Card: e.g. Visa debit 4706131211212123 or Mastercard credit 5105105105105100,
 *         OTP 111000, expiry 03/2028, CVV 123 (the page lists no failing card)
 *   Netbanking: "TEST Bank" (code 3333). Wallet: the generic sandbox wallet.
 */
const METHODS = [["card (3-D Secure)", "credit_card"], ["UPI collect / intent / QR", "upi"], ["netbanking", "net_banking"], ["wallet", "wallet"]] as const;

const statusOf = async (orderId: string) => (await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status;
const coins = () => harness.db.balances.get("student-a") ?? 0;
const verify = (orderId: string) => verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
const event = (type: string, orderId: string, payment: object) => harness.cashfree.webhookRequest({ type, data: { order: { order_id: orderId }, payment } });

async function order() {
  return (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
}

describe.each(METHODS)("7. %s", (_label, group) => {
  it("success: credited once via checkout or webhook", async () => {
    const orderId = await order();
    const payment = harness.cashfree.pay(orderId, "SUCCESS", group);
    expect((await verify(orderId)).status).toBe(200);
    await webhook(event("PAYMENT_SUCCESS_WEBHOOK", orderId, payment));
    expect(await statusOf(orderId)).toBe("PAID");
    expect(coins()).toBe(100);
  });

  it("failure: nothing credited, order FAILED but still payable on retry", async () => {
    const orderId = await order();
    const failed = harness.cashfree.pay(orderId, "FAILED", group);
    expect((await verify(orderId)).status).toBe(409);
    await webhook(event("PAYMENT_FAILED_WEBHOOK", orderId, failed));
    expect(await statusOf(orderId)).toBe("FAILED");
    expect(coins()).toBe(0);

    harness.cashfree.pay(orderId, "SUCCESS", group);
    expect((await verify(orderId)).status).toBe(200);
    expect(coins()).toBe(100);
  });

  it("pending: verify answers 409 and credits nothing; the later success webhook credits", async () => {
    const orderId = await order();
    harness.cashfree.pay(orderId, "PENDING", group);
    const response = await verify(orderId);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/awaiting confirmation/i);
    expect(coins()).toBe(0);

    const success = harness.cashfree.pay(orderId, "SUCCESS", group);
    await webhook(event("PAYMENT_SUCCESS_WEBHOOK", orderId, success));
    expect(coins()).toBe(100);
  });

  it("abandoned: user drops out, nothing credited, and the order expires", async () => {
    const orderId = await order();
    const dropped = harness.cashfree.pay(orderId, "USER_DROPPED", group);
    await webhook(event("PAYMENT_USER_DROPPED_WEBHOOK", orderId, dropped));
    expect(await statusOf(orderId)).toBe("FAILED");

    harness.cashfree.expire(orderId);
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - 40 * 60_000) } });
    await reconcilePaymentOrders();
    expect(await statusOf(orderId)).toBe("EXPIRED");
    expect(coins()).toBe(0);
  });
});

describe("7. abandoned before any attempt (checkout closed)", () => {
  it("an order with no payment attempt is expired by reconciliation and never credited", async () => {
    const orderId = await order();
    harness.cashfree.expire(orderId);
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - 40 * 60_000) } });
    expect((await reconcilePaymentOrders()).expired).toEqual([orderId]);
    expect(coins()).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

/**
 * Live check against the real Cashfree SANDBOX. Skipped unless both
 * CASHFREE_SANDBOX_CLIENT_ID and CASHFREE_SANDBOX_CLIENT_SECRET are set, and
 * it refuses anything that looks like a production key. It never sends
 * money: it creates a ₹1 sandbox order and reads it back, which checks our
 * request shape, credentials, API version and the fields we parse.
 *
 * Completing payments (test cards / UPI IDs) needs Cashfree's hosted checkout
 * in a browser and is a manual step on the go-live checklist.
 */
const id = process.env.CASHFREE_SANDBOX_CLIENT_ID;
const secret = process.env.CASHFREE_SANDBOX_CLIENT_SECRET;
const looksLive = (value?: string) => Boolean(value && /prod/i.test(value));
const enabled = Boolean(id && secret) && !looksLive(id) && !looksLive(secret);

describe.skipIf(!enabled)("7. Cashfree sandbox (live, test mode only)", () => {
  it("creates an order with our request shape and reads it back", async () => {
    process.env.CASHFREE_CLIENT_ID = id;
    process.env.CASHFREE_CLIENT_SECRET = secret;
    process.env.CASHFREE_ENV = "sandbox";
    const { createCashfreeOrder, fetchCashfreeOrder, fetchSuccessfulPayment } = await import("@repo/live-classes");
    const orderId = `coins_1_sandbox${Date.now()}`;

    const created = await createCashfreeOrder({ orderId, amountInr: 1, customerId: "sandbox-test" });
    expect(created).toMatchObject({ orderId, mode: "sandbox", paymentSessionId: expect.any(String) });
    expect(await fetchCashfreeOrder(orderId)).toMatchObject({ status: "ACTIVE" });
    expect(await fetchSuccessfulPayment(orderId)).toBeNull();
  }, 30_000);
});

it("refuses to run the live sandbox test with production-looking keys", () => {
  expect(looksLive("cfsk_ma_prod_xxx")).toBe(true);
  expect(looksLive("cfsk_ma_test_xxx")).toBe(false);
});

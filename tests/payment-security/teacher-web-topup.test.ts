import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());
vi.mock("../../apps/teacher-web/src/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("../../apps/teacher-web/src/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("../../apps/teacher-web/src/app/api/payments/verify-payment/route");
const { POST: webhook } = await import("../../apps/teacher-web/src/app/api/webhooks/cashfree/route");
const { POST: studentWebCreateOrder } = await import("@/app/api/payments/create-order/route");
const { COIN_PACKAGES } = await import("@repo/api-contracts");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const order = async (body: unknown) => createOrder(jsonRequest("/api/payments/create-order", body));

describe("teacher-web wallet: Top up Coins", () => {
  it("offers the shared 1 coin = ₹1 packs", () => {
    expect(COIN_PACKAGES.map((p) => [p.id, p.coins, p.priceInr])).toEqual([["tier1", 100, 100], ["tier2", 500, 500], ["tier3", 1000, 1000]]);
  });

  it("creates a Cashfree order at the server price and credits the coins once Cashfree confirms", async () => {
    const response = await order({ packageId: "tier2" });
    expect(response.status).toBe(200);
    const { orderId, paymentSessionId, mode } = await response.json();
    expect({ paymentSessionId, mode }).toEqual({ paymentSessionId: `session_${orderId}`, mode: "sandbox" });
    expect(harness.cashfree.orders.get(orderId)).toMatchObject({ order_amount: 500, order_currency: "INR" });

    harness.cashfree.pay(orderId, "SUCCESS");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(500);
  });

  it("reports a pending payment as 409 so the wallet can show it as processing", async () => {
    const { orderId } = await (await order({ packageId: "tier1" })).json();
    harness.cashfree.pay(orderId, "PENDING");
    const response = await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    expect(response.status).toBe(409);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it.each([{ packageId: "tier3", amount: 1 }, { packageId: "nope" }, { packageId: "tier1", currency: "USD" }, { amount: 99.5 }])("rejects a tampered request %j", async (body) => {
    expect((await order(body)).status).toBe(400);
    expect(harness.cashfree.calls).toHaveLength(0);
  });

  it("a custom amount buys exactly that many coins (1 coin = ₹1)", async () => {
    const response = await order({ customAmountInr: 250 });
    expect(response.status).toBe(200);
    const { orderId } = await response.json();
    expect(orderId).toMatch(/^coins_250_/);
    expect(orderId.length).toBeLessThanOrEqual(35);
    expect(harness.cashfree.orders.get(orderId)).toMatchObject({ order_amount: 250, order_currency: "INR" });

    harness.cashfree.pay(orderId, "SUCCESS");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(250);
  });

  it("accepts the bounds ₹1 and ₹1,00,000 and keeps order ids short enough for refunds", async () => {
    for (const amount of [1, 100000]) {
      const response = await order({ customAmountInr: amount });
      expect(response.status).toBe(200);
      const { orderId } = await response.json();
      expect(`rf_${orderId}`.length).toBeLessThanOrEqual(40);
    }
  });

  it.each([
    [{ customAmountInr: 0 }], [{ customAmountInr: -5 }], [{ customAmountInr: 2.5 }], [{ customAmountInr: 100001 }],
    [{ customAmountInr: "500" }], [{ customAmountInr: 500, packageId: "tier1" }], [{ customAmountInr: 500, amount: 1 }],
    [{ customAmountInr: 500, currency: "USD" }],
  ])("rejects an invalid custom amount %j before contacting Cashfree", async (body) => {
    expect((await order(body)).status).toBe(400);
    expect(harness.cashfree.calls).toHaveLength(0);
  });

  it("requires a signed-in student", async () => {
    harness.signIn(null);
    expect((await order({ packageId: "tier1" })).status).toBe(401);
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId: "coins_100_x" }))).status).toBe(401);
  });

  it("does not let one student verify another's order", async () => {
    harness.signIn("student-b");
    const { orderId } = await (await order({ packageId: "tier1" })).json();
    harness.cashfree.pay(orderId, "SUCCESS");
    harness.signIn("student-a");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(404);
  });

  it("teacher-web also receives the Cashfree webhook, crediting once", async () => {
    const { orderId } = await (await order({ packageId: "tier1" })).json();
    const payment = harness.cashfree.pay(orderId, "SUCCESS");
    const event = harness.cashfree.successWebhook(orderId, payment);
    expect((await webhook(harness.cashfree.webhookRequest(event))).status).toBe(200);
    expect((await webhook(harness.cashfree.webhookRequest(event))).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(100);
    expect((await webhook(harness.cashfree.webhookRequest(event, { secret: "wrong" }))).status).toBe(400);
  });

  it("an order opened in teacher-web is the same kind student-web opens (one shared implementation)", async () => {
    const a = await (await order({ packageId: "tier1" })).json();
    const b = await (await studentWebCreateOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json();
    expect(a.orderId).toMatch(/^coins_100_/);
    expect(b.orderId).toMatch(/^coins_100_/);
    expect(Object.keys(a).sort()).toEqual(Object.keys(b).sort());
  });
});

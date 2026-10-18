import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

async function paidOrder() {
  const response = await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier2" }));
  const orderId = (await response.json()).orderId as string;
  const payment = harness.cashfree.pay(orderId, "SUCCESS");
  return { orderId, event: harness.cashfree.successWebhook(orderId, payment) };
}

describe("3. invalid, replayed and duplicate webhooks", () => {
  it("rejects a webhook signed with the wrong secret", async () => {
    const { event } = await paidOrder();
    expect((await webhook(harness.cashfree.webhookRequest(event, { secret: "attacker-secret" }))).status).toBe(400);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("rejects a webhook whose body was changed after signing", async () => {
    const { event } = await paidOrder();
    const signed = harness.cashfree.webhookRequest(event);
    const tampered = new Request(signed.url, { method: "POST", headers: signed.headers, body: JSON.stringify({ ...event, data: { ...event.data, payment: { ...event.data.payment, payment_amount: 100000 } } }) });
    expect((await webhook(tampered)).status).toBe(400);
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("rejects a webhook with no signature headers", async () => {
    const { event } = await paidOrder();
    expect((await webhook(new Request("https://example.test/api/webhooks/cashfree", { method: "POST", body: JSON.stringify(event) }))).status).toBe(400);
  });

  it("credits once when the same signed event is delivered three times (duplicate)", async () => {
    const { event } = await paidOrder();
    for (let i = 0; i < 3; i++) expect((await webhook(harness.cashfree.webhookRequest(event))).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(500);
    expect(await harness.db.db.coinTransaction.count()).toBe(1);
  });

  it("credits once when a captured request is replayed later with its original headers (replay)", async () => {
    const { event } = await paidOrder();
    const original = harness.cashfree.webhookRequest(event);
    const replay = original.clone();
    expect((await webhook(original)).status).toBe(200);
    expect((await webhook(replay)).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(500);
  });

  it("ignores a signed success event for a payment that does not match the order amount", async () => {
    const { orderId } = await paidOrder();
    const event = harness.cashfree.successWebhook(orderId, { cf_payment_id: 1, payment_amount: 1, payment_currency: "INR", payment_status: "SUCCESS" });
    await webhook(harness.cashfree.webhookRequest(event));
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });
});

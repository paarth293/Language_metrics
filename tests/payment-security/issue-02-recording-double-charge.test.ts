import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");
const { POST: verifyRecording } = await import("@/app/api/students/payments/cashfree/verify/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");

const RECORDING = "55555555-5555-4555-8555-555555555555";
const receiptPrefix = `rec_${Buffer.from(RECORDING.replaceAll("-", ""), "hex").toString("base64url")}_`;

beforeEach(async () => {
  harness.reset();
  await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "booking-a", booking: { studentId: "student-a" } } });
});
afterEach(() => harness.teardown());

const order = async () => (await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING }))).json();

/** Two open orders for one recording, as left behind by a race or by code older than this fix. */
async function twoOpenOrders() {
  const ids = [`${receiptPrefix}aaaaaaaa`, `${receiptPrefix}bbbbbbbb`];
  for (const orderId of ids) {
    await harness.cashfree.fetch("https://sandbox.cashfree.com/pg/orders", {
      method: "POST", headers: { "x-client-secret": "test-client-secret" },
      body: JSON.stringify({ order_id: orderId, order_amount: 299, order_currency: "INR", customer_details: {} }),
    });
    await harness.db.db.paymentOrder.create({ data: { orderId, receipt: orderId, userId: "student-a", amount: 299 } });
  }
  return ids;
}

describe("issue #2: paying twice for one recording", () => {
  it("a second tab gets the same open order instead of a new chargeable one", async () => {
    const first = await order();
    const second = await order();
    expect(second.orderId).toBe(first.orderId);
    expect(second.paymentSessionId).toBe(first.paymentSessionId);
    expect(harness.cashfree.orders.size).toBe(1);
  });

  it("an order whose first attempt failed is still reused (it stays payable)", async () => {
    const first = await order();
    const attempt = harness.cashfree.pay(first.orderId, "FAILED");
    await webhook(harness.cashfree.webhookRequest({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: first.orderId }, payment: attempt } }));
    const second = await order();
    expect(second.orderId).toBe(first.orderId);
    expect(harness.cashfree.orders.size).toBe(1);
  });

  it("ordering again after the first order was paid settles it instead of charging again", async () => {
    const first = await order();
    harness.cashfree.pay(first.orderId, "SUCCESS");
    const response = await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING }));
    expect(response.status).toBe(409);
    expect(harness.cashfree.orders.size).toBe(1);
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING } }))?.isRecordingPaid).toBe(true);
  });

  it("an expired open order is replaced by a fresh one", async () => {
    const first = await order();
    harness.cashfree.expire(first.orderId);
    const second = await order();
    expect(second.orderId).not.toBe(first.orderId);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId: first.orderId } }))?.status).toBe("EXPIRED");
  });

  it("when two orders were both paid, the recording is unlocked and billed once and the extra is flagged DUPLICATE", async () => {
    const [a, b] = await twoOpenOrders();
    harness.cashfree.pay(a!, "SUCCESS");
    harness.cashfree.pay(b!, "SUCCESS");
    expect((await verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId: a }))).status).toBe(200);
    expect((await verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId: b }))).status).toBe(200);

    expect(await harness.db.db.payment.count({ where: { type: "RECORDING_FEE" } })).toBe(1);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId: a } }))?.status).toBe("PAID");
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId: b } }))?.status).toBe("DUPLICATE");
  });

  it("two paid orders settling at the same moment still unlock and bill once", async () => {
    const [a, b] = await twoOpenOrders();
    const pa = harness.cashfree.pay(a!, "SUCCESS");
    const pb = harness.cashfree.pay(b!, "SUCCESS");
    await Promise.all([
      webhook(harness.cashfree.webhookRequest(harness.cashfree.successWebhook(a!, pa))),
      webhook(harness.cashfree.webhookRequest(harness.cashfree.successWebhook(b!, pb))),
      verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId: a })),
      verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId: b })),
    ]);
    expect(await harness.db.db.payment.count({ where: { type: "RECORDING_FEE" } })).toBe(1);
    const statuses = (await harness.db.db.paymentOrder.findMany()).map((o) => o.status).sort();
    expect(statuses).toEqual(["DUPLICATE", "PAID"]);
  });
});

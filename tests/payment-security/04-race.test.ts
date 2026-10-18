import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");
const { POST: verifyRecording } = await import("@/app/api/students/payments/cashfree/verify/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const RECORDING = "22222222-2222-4222-8222-222222222222";

describe("4. harness sanity", () => {
  it("the fake database really interleaves: a naive read-then-write settle double-credits", async () => {
    const { db } = harness.db;
    await db.paymentOrder.create({ data: { orderId: "naive", userId: "student-a", amount: 100 } });
    let credits = 0;
    const naiveSettle = async () => {
      const order = await db.paymentOrder.findUnique({ where: { orderId: "naive" } });
      if (order?.status === "PAID") return;
      await db.paymentOrder.update({ where: { orderId: "naive" }, data: { status: "PAID" } });
      credits++;
    };
    await Promise.all(Array.from({ length: 5 }, naiveSettle));
    expect(credits).toBeGreaterThan(1);
  });
});

describe("4. callback + webhook + 20 parallel verify calls", () => {
  it("credits a coin order exactly once", async () => {
    const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId;
    const payment = harness.cashfree.pay(orderId, "SUCCESS");
    const callback = verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    const hook = webhook(harness.cashfree.webhookRequest(harness.cashfree.successWebhook(orderId, payment)));
    const verifies = Array.from({ length: 20 }, () => verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId })));

    const statuses = (await Promise.all([callback, hook, ...verifies])).map((r) => r.status);

    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(harness.db.balances.get("student-a")).toBe(100);
    expect(await harness.db.db.coinTransaction.count()).toBe(1);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))).toMatchObject({ status: "PAID", paymentId: String(payment.cf_payment_id) });
  });

  it("unlocks a recording and records one Payment row exactly once", async () => {
    await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "booking-a", booking: { studentId: "student-a" } } });
    const orderId = (await (await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING }))).json()).orderId;
    const payment = harness.cashfree.pay(orderId, "SUCCESS");
    const calls = [
      verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId })),
      webhook(harness.cashfree.webhookRequest(harness.cashfree.successWebhook(orderId, payment))),
      ...Array.from({ length: 20 }, () => verifyRecording(jsonRequest("/api/students/payments/cashfree/verify", { orderId }))),
    ];
    const statuses = (await Promise.all(calls)).map((r) => r.status);

    expect(statuses.every((s) => s === 200)).toBe(true);
    expect(await harness.db.db.payment.count({ where: { type: "RECORDING_FEE" } })).toBe(1);
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING } }))?.isRecordingPaid).toBe(true);
  });
});

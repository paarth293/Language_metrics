import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");
const { GET: reconcileStudentWeb } = await import("@/app/api/cron/reconcile-payments/route");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const RECORDING = "44444444-4444-4444-8444-444444444444";
const cron = (secret = "test-cron-secret") => new NextRequest("https://example.test/api/cron/reconcile-payments", { headers: { authorization: `Bearer ${secret}` } });

/** Pretend the order was created `minutes` ago. */
async function age(orderId: string, minutes: number) {
  await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - minutes * 60_000) } });
}

async function coinOrder(packageId = "tier2") {
  return (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId }))).json()).orderId as string;
}

describe("6. payment succeeded but the webhook was missed", () => {
  it("the reconciliation job credits the coins (and the browser never called verify)", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    await age(orderId, 20);

    const response = await reconcileStudentWeb(cron());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ settled: [orderId] });
    expect(harness.db.balances.get("student-a")).toBe(500);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("PAID");
  });

  it("the job unlocks a paid recording", async () => {
    await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "booking-a", booking: { studentId: "student-a" } } });
    const orderId = (await (await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING }))).json()).orderId;
    harness.cashfree.pay(orderId, "SUCCESS");
    await age(orderId, 20);

    // Cron is served by student-web only (#20); teacher-web answers 410.
    await reconcileStudentWeb(cron());
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING } }))?.isRecordingPaid).toBe(true);
  });

  it("marks an abandoned order EXPIRED once Cashfree expires it, crediting nothing", async () => {
    const orderId = await coinOrder();
    harness.cashfree.expire(orderId);
    await age(orderId, 40);

    expect(await (await reconcileStudentWeb(cron())).json()).toMatchObject({ expired: [orderId] });
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("EXPIRED");
    expect(harness.db.balances.get("student-a") ?? 0).toBe(0);
  });

  it("leaves an order that is still being paid alone", async () => {
    const orderId = await coinOrder();
    await age(orderId, 1);
    harness.cashfree.calls.length = 0;
    await reconcileStudentWeb(cron());
    expect(harness.cashfree.calls).toHaveLength(0);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("CREATED");
  });

  it("reports an unpaid order older than an hour as stuck", async () => {
    const orderId = await coinOrder();
    await age(orderId, 90);
    expect(await (await reconcileStudentWeb(cron())).json()).toMatchObject({ stuck: [orderId] });
  });

  it("is idempotent: running twice credits once", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    await age(orderId, 20);
    await reconcileStudentWeb(cron());
    await reconcileStudentWeb(cron());
    expect(harness.db.balances.get("student-a")).toBe(500);
    expect(await harness.db.db.coinTransaction.count()).toBe(1);
  });

  it("refuses callers without the cron secret, before touching Cashfree", async () => {
    const orderId = await coinOrder();
    harness.cashfree.pay(orderId, "SUCCESS");
    await age(orderId, 20);
    harness.cashfree.calls.length = 0;
    expect((await reconcileStudentWeb(cron("wrong"))).status).toBe(401);
    expect((await reconcileStudentWeb(new NextRequest("https://example.test/api/cron/reconcile-payments"))).status).toBe(401);
    expect(harness.cashfree.calls).toHaveLength(0);
    vi.stubEnv("CRON_SECRET", "");
    expect((await reconcileStudentWeb(cron())).status).toBe(500);
  });
});

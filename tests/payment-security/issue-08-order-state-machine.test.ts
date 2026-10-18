import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const live = await import("@repo/live-classes");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const statusOf = async (orderId: string) => (await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status;
const setStatus = (orderId: string, status: string) => harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { status } });

async function paidOrder() {
  const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
  harness.cashfree.pay(orderId, "SUCCESS");
  return orderId;
}

describe("issue #8: payment orders follow a guarded state machine", () => {
  it("defines exactly the statuses the code uses", () => {
    expect([...live.PAYMENT_ORDER_STATUSES].sort()).toEqual(
      ["CREATED", "DUPLICATE", "EXPIRED", "FAILED", "NEEDS_REVIEW", "PAID", "REFUNDED", "REFUND_PENDING"],
    );
  });

  it.each([
    ["PAID", "CREATED"], ["PAID", "FAILED"], ["PAID", "EXPIRED"], ["REFUNDED", "PAID"],
    ["REFUNDED", "CREATED"], ["NEEDS_REVIEW", "PAID"], ["DUPLICATE", "PAID"], ["EXPIRED", "CREATED"],
  ])("blocks %s -> %s", (from, to) => {
    expect(live.canTransitionOrder(from as never, to as never)).toBe(false);
  });

  it.each([
    ["CREATED", "PAID"], ["FAILED", "PAID"], ["EXPIRED", "PAID"], ["CREATED", "FAILED"],
    ["PAID", "REFUND_PENDING"], ["REFUND_PENDING", "REFUNDED"], ["DUPLICATE", "REFUND_PENDING"],
  ])("allows %s -> %s", (from, to) => {
    expect(live.canTransitionOrder(from as never, to as never)).toBe(true);
  });

  it("transitionOrder writes nothing for a blocked move", async () => {
    const orderId = await paidOrder();
    await setStatus(orderId, "REFUNDED");
    expect(await live.transitionOrder(harness.db.db as never, { orderId }, "PAID")).toBe(0);
    expect(await statusOf(orderId)).toBe("REFUNDED");
  });

  it("a REFUNDED order cannot be fulfilled again by a verify call (Cashfree still lists its payment as SUCCESS)", async () => {
    const orderId = await paidOrder();
    await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    await setStatus(orderId, "REFUNDED");
    const coinsBefore = harness.db.balances.get("student-a");

    const response = await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
    expect(response.status).toBe(409);
    expect(await statusOf(orderId)).toBe("REFUNDED");
    expect(harness.db.balances.get("student-a")).toBe(coinsBefore);
    expect(await harness.db.db.payment.count()).toBe(1);
  });

  it("a NEEDS_REVIEW order is not moved by a later failure event", async () => {
    const orderId = await paidOrder();
    await setStatus(orderId, "NEEDS_REVIEW");
    const attempt = harness.cashfree.pay(orderId, "FAILED");
    await webhook(harness.cashfree.webhookRequest({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: orderId }, payment: attempt } }));
    expect(await statusOf(orderId)).toBe("NEEDS_REVIEW");
  });

  it("a late success on an EXPIRED order is still honoured, because the money is real", async () => {
    const orderId = await paidOrder();
    await setStatus(orderId, "EXPIRED");
    expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(200);
    expect(await statusOf(orderId)).toBe("PAID");
  });

  it("the database enforces the same status list (CHECK constraint migration)", () => {
    const dir = join(__dirname, "../../packages/database/prisma/migrations");
    const migration = readdirSync(dir).find((name) => name.endsWith("_payment_order_status_check"));
    expect(migration, "migration directory").toBeDefined();
    const sql = readFileSync(join(dir, migration!, "migration.sql"), "utf8");
    const listed = [...sql.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual([...live.PAYMENT_ORDER_STATUSES].sort());
  });
});

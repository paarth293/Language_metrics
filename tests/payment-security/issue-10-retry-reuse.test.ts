import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

// #10, option A (audit/PLAN_10.md): a retried coin purchase reuses the open
// order for the same pack while Cashfree still accepts payment for it.
vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());
vi.mock("@/lib/rate-limit", () => ({ rateLimitRedis: async () => false }));

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");

beforeEach(() => {
  harness.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  harness.teardown();
});

const buyCoins = (packageId = "tier2") => createOrder(jsonRequest("/api/payments/create-order", { packageId }));
const createCalls = () => harness.cashfree.calls.filter((c) => c.method === "POST" && c.path === "/orders").length;
const rows = () => harness.db.db.paymentOrder.findMany({});

async function age(orderId: string, minutes: number) {
  await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - minutes * 60_000) } });
}

describe("#10 coins: a retried purchase reuses the open order", () => {
  it("a retried request does not create a second order", async () => {
    const first = await (await buyCoins()).json();
    const second = await (await buyCoins()).json();
    expect(second).toEqual(first);
    expect(createCalls()).toBe(1);
    expect(await rows()).toHaveLength(1);
  });

  it("a retry after Cashfree rejected the first attempt opens a new order", async () => {
    harness.cashfree.failNext(500);
    expect((await buyCoins()).status).toBe(502);
    expect((await buyCoins()).status).toBe(200);
    expect((await rows()).map((r) => r.status).sort()).toEqual(["CREATED", "FAILED"]);
  });
});

describe("#10 coins: reuse is per pack and only while Cashfree still accepts payment", () => {
  it("a different pack opens its own order", async () => {
    const small = await (await buyCoins("tier1")).json();
    const large = await (await buyCoins("tier2")).json();
    expect(large.orderId).not.toBe(small.orderId);
    expect(createCalls()).toBe(2);
  });

  it("an open order Cashfree has expired is marked EXPIRED and replaced", async () => {
    const first = await (await buyCoins()).json();
    harness.cashfree.expire(first.orderId);
    const second = await (await buyCoins()).json();
    expect(second.orderId).not.toBe(first.orderId);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId: first.orderId } }))?.status).toBe("EXPIRED");
  });

  it("an order older than its 30-minute Cashfree lifetime is not reused", async () => {
    const first = await (await buyCoins()).json();
    await age(first.orderId, 31);
    const second = await (await buyCoins()).json();
    expect(second.orderId).not.toBe(first.orderId);
  });
});

describe("#10 coins: a row whose Cashfree call may still be running is never expired", () => {
  /** A CREATED row inserted moments ago by another request that has not reached Cashfree yet. */
  async function inFlightRow(orderId: string) {
    await harness.db.db.paymentOrder.create({ data: { orderId, userId: "student-a", amount: 500, currency: "INR", status: "CREATED", receipt: orderId } });
  }

  it("coins: the in-flight row is not reused and stays CREATED", async () => {
    await inFlightRow("coins_500_inflight");
    expect((await buyCoins()).status).toBe(200);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId: "coins_500_inflight" } }))?.status).toBe("CREATED");
  });
});

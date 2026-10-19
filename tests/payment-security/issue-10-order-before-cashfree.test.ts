import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

// #10: the PaymentOrder row is saved (CREATED) before Cashfree is called, so
// Cashfree never holds an order we have no record of. See audit/PLAN_10.md.
vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());
vi.mock("@/lib/rate-limit", () => ({ rateLimitRedis: async () => false }));

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");
const { GET: reconcile } = await import("@/app/api/cron/reconcile-payments/route");

const RECORDING = "44444444-4444-4444-8444-444444444444";

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
const buyRecording = () => createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING }));
const cron = () => new NextRequest("https://example.test/api/cron/reconcile-payments", { headers: { authorization: "Bearer test-cron-secret" } });
const createCalls = () => harness.cashfree.calls.filter((c) => c.method === "POST" && c.path === "/orders").length;
const rows = () => harness.db.db.paymentOrder.findMany({});

async function age(orderId: string, minutes: number) {
  await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - minutes * 60_000) } });
}

/** Make Cashfree's POST /orders fail at the network level (the GETs still work). */
function cashfreeCreateThrows(error: Error) {
  const fakeFetch = globalThis.fetch;
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    if ((init?.method ?? "GET").toUpperCase() === "POST" && String(input).endsWith("/orders")) throw error;
    return fakeFetch(input, init);
  });
}

async function withRecording() {
  await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "booking-a", booking: { studentId: "student-a" } } });
}

describe.each([
  ["coins", async () => {}, buyCoins],
  ["recording", withRecording, buyRecording],
] as const)("#10 %s: PaymentOrder row before the Cashfree order", (_flow, setup, buy) => {
  beforeEach(async () => { await setup(); });

  it("saves the CREATED row before calling Cashfree, and returns the same response shape", async () => {
    let rowsWhenCashfreeCalled = -1;
    const fakeFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
      if ((init?.method ?? "GET").toUpperCase() === "POST" && String(input).endsWith("/orders")) {
        rowsWhenCashfreeCalled = (await rows()).filter((r) => r.status === "CREATED").length;
      }
      return fakeFetch(input, init);
    });
    const response = await buy();
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ orderId: expect.any(String), paymentSessionId: `session_${body.orderId}`, mode: "sandbox" });
    expect(rowsWhenCashfreeCalled).toBe(1);
    expect(await rows()).toEqual([expect.objectContaining({ orderId: body.orderId, status: "CREATED" })]);
  });

  it("DB insert fails -> no Cashfree order", async () => {
    vi.spyOn(harness.db.db.paymentOrder, "create").mockRejectedValueOnce(new Error("Timed out fetching a new connection from the connection pool"));
    expect((await buy()).status).toBe(500);
    expect(createCalls()).toBe(0);
    expect(harness.cashfree.orders.size).toBe(0);
  });

  it.each([
    ["a 5xx answer", () => harness.cashfree.failNext(500), 502],
    ["a 4xx answer", () => harness.cashfree.failNext(400), 502],
    ["a network error", () => cashfreeCreateThrows(new TypeError("fetch failed")), 502],
    ["a timeout", () => cashfreeCreateThrows(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" })), 504],
  ] as const)("Cashfree fails with %s -> the row is FAILED and the error is clean", async (_case, fail, status) => {
    fail();
    const response = await buy();
    expect(response.status).toBe(status);
    expect(Object.keys(await response.json())).toEqual(["error"]);
    expect(await rows()).toEqual([expect.objectContaining({ status: "FAILED" })]);
  });
});

describe("#10 crash case: a row with no Cashfree order", () => {
  /** A row as left by a crash between the insert and the Cashfree call. */
  async function orphanRow(status: "CREATED" | "FAILED", minutesOld: number) {
    const orderId = `coins_500_${status.toLowerCase()}orphan${minutesOld}`;
    await harness.db.db.paymentOrder.create({ data: { orderId, userId: "student-a", amount: 500, currency: "INR", status, receipt: orderId } });
    await age(orderId, minutesOld);
    return orderId;
  }

  it.each(["CREATED", "FAILED"] as const)("the reconciler marks a %s row EXPIRED quietly when Cashfree has no such order", async (status) => {
    const orderId = await orphanRow(status, 15);
    const summary = await (await reconcile(cron())).json();
    expect(summary).toMatchObject({ expired: [orderId], failed: [] });
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("EXPIRED");
    expect(harness.alerts).toEqual([]); // no reconciliation_failed incident
  });

  it("leaves a row younger than 10 minutes alone (its request may still be running)", async () => {
    const orderId = await orphanRow("CREATED", 2);
    expect(await (await reconcile(cron())).json()).toMatchObject({ checked: 0, expired: [] });
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status).toBe("CREATED");
  });

  it("a retried recording purchase reuses the open order", async () => {
    await withRecording();
    const first = await (await buyRecording()).json();
    expect(await (await buyRecording()).json()).toEqual(first);
    expect(createCalls()).toBe(1);
  });

  it("a recording row whose Cashfree call may still be running is not reused, and stays CREATED", async () => {
    await withRecording();
    const first = await (await buyRecording()).json();
    harness.cashfree.orders.clear(); // Cashfree has not created it yet
    expect((await buyRecording()).status).toBe(200);
    expect((await harness.db.db.paymentOrder.findUnique({ where: { orderId: first.orderId } }))?.status).toBe("CREATED");
  });

  it("a recording purchase whose open row has no Cashfree order opens a new order instead of failing", async () => {
    await withRecording();
    const prefix = (await (await buyRecording()).json()).orderId.slice(0, -8);
    harness.cashfree.orders.clear(); // the open row now has no Cashfree order, like after a crash
    await harness.db.db.paymentOrder.updateMany({ where: {}, data: { createdAt: new Date(Date.now() - 2 * 60_000) } });
    const response = await buyRecording();
    expect(response.status).toBe(200);
    const { orderId } = await response.json();
    expect(orderId.startsWith(prefix)).toBe(true);
    const statuses = (await rows()).map((r) => r.status).sort();
    expect(statuses).toEqual(["CREATED", "EXPIRED"]);
  });
});

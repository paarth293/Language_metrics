import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const studentPayments = await import("@/app/api/cron/reconcile-payments/route");
const studentSessions = await import("@/app/api/cron/reconcile-sessions/route");
const teacherPayments = await import("../../apps/teacher-web/src/app/api/cron/reconcile-payments/route");
const teacherSessions = await import("../../apps/teacher-web/src/app/api/cron/reconcile-sessions/route");
const { reconcilePaymentOrders } = await import("@repo/live-classes");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const cron = (path: string) => new NextRequest(`https://example.test${path}`, { headers: { authorization: "Bearer test-cron-secret" } });

/**
 * `count` unpaid coin orders, made through the real route and aged 20 minutes;
 * Cashfree lists them as ACTIVE. One student each: a student's retry reuses
 * their open order for the same pack (#10).
 */
async function backlog(count: number) {
  for (let i = 0; i < count; i++) {
    harness.signIn(`student-${i}`);
    const response = await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier2" }));
    expect(response.status).toBe(200);
  }
  await harness.db.db.paymentOrder.updateMany({ where: { status: "CREATED" }, data: { createdAt: new Date(Date.now() - 20 * 60_000) } });
}

describe("#20 cron safety", () => {
  it("two simultaneous payment sweeps: only one does the work", async () => {
    await backlog(3);
    const [a, b] = await Promise.all([studentPayments.GET(cron("/api/cron/reconcile-payments")), studentPayments.GET(cron("/api/cron/reconcile-payments"))]);
    const bodies = [await a.json(), await b.json()];
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(bodies.filter((body) => body.skipped === "locked")).toHaveLength(1);
    expect(bodies.filter((body) => body.checked === 3)).toHaveLength(1);
  });

  it("two simultaneous session sweeps: only one does the work", async () => {
    const [a, b] = await Promise.all([studentSessions.GET(cron("/api/cron/reconcile-sessions")), studentSessions.GET(cron("/api/cron/reconcile-sessions"))]);
    const bodies = [await a.json(), await b.json()];
    expect(bodies.filter((body) => body.skipped === "locked")).toHaveLength(1);
  });

  it("the lock is released, so the next sweep runs", async () => {
    await studentPayments.GET(cron("/api/cron/reconcile-payments"));
    const next = await (await studentPayments.GET(cron("/api/cron/reconcile-payments"))).json();
    expect(next.skipped).toBeUndefined();
  });

  it("one run clears a backlog bigger than one batch of 50", async () => {
    await backlog(120);
    const summary = await (await studentPayments.GET(cron("/api/cron/reconcile-payments"))).json();
    expect(summary.checked).toBe(120);
    expect(summary.batches).toBe(3);
    expect(summary.budgetExhausted).toBe(false);
  });

  it("stops at the time budget instead of running past it", async () => {
    await backlog(120);
    const summary = await reconcilePaymentOrders(new Date(), { budgetMs: 0 });
    expect(summary.checked).toBe(50);
    expect(summary.budgetExhausted).toBe(true);
  });

  it("student-web cron routes declare maxDuration = 60", () => {
    expect(studentPayments.maxDuration).toBe(60);
    expect(studentSessions.maxDuration).toBe(60);
  });

  it("teacher-web cron routes return 410 and do no work", async () => {
    await backlog(1);
    for (const [route, path] of [[teacherPayments, "/api/cron/reconcile-payments"], [teacherSessions, "/api/cron/reconcile-sessions"]] as const) {
      const response = await route.GET(cron(path));
      expect(response.status).toBe(410);
      expect(await response.json()).toEqual({ message: "Cron jobs run on student-web.", moved_to: "student-web" });
    }
    expect((await harness.db.db.paymentOrder.findMany({ where: { status: "CREATED" } }))).toHaveLength(1);
  });
});

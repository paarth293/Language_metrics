import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { findPaymentIntegrityProblems } = await import("@repo/live-classes");

beforeEach(() => harness.reset());
afterEach(() => harness.teardown());

const RECORDING = "88888888-8888-4888-8888-888888888888";
const recOrderId = `rec_${Buffer.from(RECORDING.replaceAll("-", ""), "hex").toString("base64url")}_eeeeeeee`;

async function paidCoinOrder() {
  const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId as string;
  harness.cashfree.pay(orderId, "SUCCESS");
  await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }));
  return orderId;
}
const run = () => findPaymentIntegrityProblems(harness.db.db as never);

describe("10. payment integrity checks", () => {
  it("a healthy paid order reports no problems", async () => {
    await paidCoinOrder();
    expect(await run()).toEqual({ paidNotFulfilled: [], fulfilledNotPaid: [], duplicatePaymentIds: [], pendingTooLong: [] });
  });

  it("paid but not fulfilled: a PAID coin order with no ledger credit, and a PAID recording still locked", async () => {
    await harness.db.db.paymentOrder.create({ data: { orderId: "coins_100_orphan", receipt: "coins_100_orphan", userId: "student-a", amount: 100, status: "PAID", paymentId: "p1" } });
    await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "b", booking: { studentId: "student-a" }, isRecordingPaid: false } });
    await harness.db.db.paymentOrder.create({ data: { orderId: recOrderId, receipt: recOrderId, userId: "student-a", amount: 299, status: "PAID", paymentId: "p2" } });
    expect((await run()).paidNotFulfilled.sort()).toEqual(["coins_100_orphan", recOrderId].sort());
  });

  it("fulfilled but not paid: coins credited, or a SUCCESS payment recorded, for an order that is not paid", async () => {
    const orderId = await paidCoinOrder();
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { status: "CREATED" } });
    expect((await run()).fulfilledNotPaid).toEqual([orderId]);
  });

  it("duplicate payment ids across orders or payment rows", async () => {
    // The unique constraints make this impossible in Postgres; the check is for
    // data imported or written around them. The fake allows it to be seeded.
    const rows = harness.db.db.paymentOrder.rows;
    rows.push({ id: "x1", orderId: "coins_1_a", userId: "u", amount: 1, status: "PAID", paymentId: "dup", receipt: null, createdAt: new Date(), updatedAt: new Date() });
    rows.push({ id: "x2", orderId: "coins_1_b", userId: "u", amount: 1, status: "PAID", paymentId: "dup", receipt: null, createdAt: new Date(), updatedAt: new Date() });
    expect((await run()).duplicatePaymentIds).toEqual(["dup"]);
  });

  it("pending longer than 30 minutes", async () => {
    const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId;
    expect((await run()).pendingTooLong).toEqual([]);
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { createdAt: new Date(Date.now() - 31 * 60_000) } });
    expect((await run()).pendingTooLong).toEqual([orderId]);
  });

  it("a refunded order whose coins were credited is not reported as fulfilled-but-unpaid", async () => {
    const orderId = await paidCoinOrder();
    await harness.db.db.paymentOrder.updateMany({ where: { orderId }, data: { status: "REFUNDED" } });
    expect((await run()).fulfilledNotPaid).toEqual([]);
  });
});

describe("10. the same checks as read-only SQL", () => {
  const sql = readFileSync(join(__dirname, "payment-integrity.sql"), "utf8");

  it("contains the four checks and nothing that writes", () => {
    for (const check of ["paid_not_fulfilled", "fulfilled_not_paid", "duplicate_payment_ids", "pending_too_long"]) expect(sql).toContain(check);
    expect(sql).not.toMatch(/\b(INSERT|UPDATE|DELETE|DROP|ALTER|TRUNCATE|CREATE|GRANT)\b/i);
  });
});

const testDb = process.env.PAYMENT_TEST_DATABASE_URL;
const isLiveDb = (url?: string) => Boolean(url && (url === process.env.DATABASE_URL || url === process.env.DIRECT_URL));

describe.skipIf(!testDb || isLiveDb(testDb))("10. integrity checks against a test database (read-only)", () => {
  it("runs every check without error", async () => {
    const { PrismaClient } = await vi.importActual<typeof import("@prisma/client")>("@prisma/client");
    const client = new PrismaClient({ datasources: { db: { url: testDb } } });
    try {
      const { findPaymentIntegrityProblems: realCheck } = await vi.importActual<typeof import("@repo/live-classes")>("@repo/live-classes");
      const problems = await realCheck(client as never);
      console.log("integrity problems:", JSON.stringify(problems));
      expect(Object.keys(problems).sort()).toEqual(["duplicatePaymentIds", "fulfilledNotPaid", "paidNotFulfilled", "pendingTooLong"]);
    } finally {
      await client.$disconnect();
    }
  }, 60_000);
});

it("never points the live integrity check at the live database", () => {
  expect(isLiveDb(process.env.DATABASE_URL ?? "unset-db-url-for-test")).toBe(Boolean(process.env.DATABASE_URL));
});

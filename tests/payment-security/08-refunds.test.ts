import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { harness, jsonRequest, loggedIncidents } from "./harness/setup";

vi.mock("@repo/database", async () => (await import("./harness/setup")).harness.database());
vi.mock("@/lib/auth", async () => (await import("./harness/setup")).harness.auth());
vi.mock("../../apps/admin-panel/src/lib/api-auth", async () => (await import("./harness/setup")).harness.adminAuth());
vi.mock("../../apps/admin-panel/src/lib/audit", async () => (await import("./harness/setup")).harness.audit());

const { POST: createOrder } = await import("@/app/api/payments/create-order/route");
const { POST: verifyPayment } = await import("@/app/api/payments/verify-payment/route");
const { POST: createRecordingOrder } = await import("@/app/api/students/payments/cashfree/order/route");
const { POST: webhook } = await import("@/app/api/webhooks/cashfree/route");
const { POST: refundRoute } = await import("../../apps/admin-panel/src/app/api/admin/payments/[orderId]/refund/route");
const { reconcilePaymentOrders } = await import("@repo/live-classes");

const FINANCE = { id: "admin-finance", permissions: ["payments:view", "payments:refund"] };
const RECORDING = "66666666-6666-4666-8666-666666666666";

let errors: ReturnType<typeof vi.spyOn>;
beforeEach(() => { harness.reset(); harness.signInAdmin(FINANCE); errors = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => { harness.teardown(); errors.mockRestore(); });

const refund = (orderId: string, body: Record<string, unknown> = { reason: "Customer asked for a refund" }) =>
  refundRoute(jsonRequest(`/api/admin/payments/${orderId}/refund`, body), { params: Promise.resolve({ orderId }) });
const statusOf = async (orderId: string) => (await harness.db.db.paymentOrder.findUnique({ where: { orderId } }))?.status;
const refundCalls = () => harness.cashfree.calls.filter((c) => c.method === "POST" && c.path.endsWith("/refunds"));

/** A ₹500 coin order, paid and credited. */
async function paidCoinOrder() {
  const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier2" }))).json()).orderId as string;
  harness.cashfree.pay(orderId, "SUCCESS");
  expect((await verifyPayment(jsonRequest("/api/payments/verify-payment", { orderId }))).status).toBe(200);
  return orderId;
}

describe("8. refunds: unauthorised", () => {
  it("rejects a caller with no admin session", async () => {
    const orderId = await paidCoinOrder();
    harness.signInAdmin(null);
    expect((await refund(orderId)).status).toBe(401);
    expect(refundCalls()).toHaveLength(0);
  });

  it("rejects an admin without the payments:refund permission", async () => {
    const orderId = await paidCoinOrder();
    harness.signInAdmin({ id: "admin-support", permissions: ["payments:view", "students:manage"] });
    expect((await refund(orderId)).status).toBe(403);
    expect(refundCalls()).toHaveLength(0);
    expect(await statusOf(orderId)).toBe("PAID");
  });

  it("has no student-facing refund route: refunds exist only in admin-panel", async () => {
    await expect(import("@/app/api/payments/refund/route")).rejects.toThrow();
  });
});

describe("8. refunds: over-refund and invalid amounts", () => {
  it.each([[501], [0], [-1], [99.5]])("rejects ₹%s against a ₹500 order without contacting Cashfree", async (amountInr) => {
    const orderId = await paidCoinOrder();
    expect((await refund(orderId, { amountInr, reason: "Customer asked for a refund" })).status).toBe(400);
    expect(refundCalls()).toHaveLength(0);
    expect(await statusOf(orderId)).toBe("PAID");
  });

  it("rejects a refund of an order that was never paid", async () => {
    const orderId = (await (await createOrder(jsonRequest("/api/payments/create-order", { packageId: "tier1" }))).json()).orderId;
    expect((await refund(orderId)).status).toBe(409);
    expect(refundCalls()).toHaveLength(0);
  });

  it("requires a reason", async () => {
    const orderId = await paidCoinOrder();
    expect((await refund(orderId, {})).status).toBe(400);
  });
});

describe("8. refunds: double refund", () => {
  it("a second refund request is rejected", async () => {
    const orderId = await paidCoinOrder();
    expect((await refund(orderId)).status).toBe(200);
    expect((await refund(orderId)).status).toBe(409);
    expect(refundCalls()).toHaveLength(1);
  });

  it("five parallel refund requests send exactly one refund and remove the coins once", async () => {
    const orderId = await paidCoinOrder();
    const statuses = (await Promise.all(Array.from({ length: 5 }, () => refund(orderId)))).map((r) => r.status);
    expect(statuses.filter((s) => s === 200)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(4);
    expect(refundCalls()).toHaveLength(1);
    expect(harness.db.balances.get("student-a")).toBe(0);
  });

  it("a refund already completed (REFUNDED) cannot be refunded again", async () => {
    const orderId = await paidCoinOrder();
    await refund(orderId);
    harness.cashfree.settleRefund(orderId, `rf_${orderId}`);
    await reconcilePaymentOrders(new Date(Date.now() + 20 * 60_000));
    expect(await statusOf(orderId)).toBe("REFUNDED");
    expect((await refund(orderId)).status).toBe(409);
  });
});

describe("8. refunds: correct refunds", () => {
  it("a full coin refund removes the coins, records the refund and is audit-logged", async () => {
    const orderId = await paidCoinOrder();
    const response = await refund(orderId);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ refundId: `rf_${orderId}`, amountInr: 500, status: "REFUND_PENDING" });
    expect(harness.cashfree.orders.get(orderId)?.refunds).toEqual([expect.objectContaining({ refund_id: `rf_${orderId}`, refund_amount: 500 })]);
    expect(harness.db.balances.get("student-a")).toBe(0);
    expect(await statusOf(orderId)).toBe("REFUND_PENDING");
    expect(await harness.db.db.payment.findFirst({ where: { gatewayPaymentId: `refund:rf_${orderId}` } })).toMatchObject({ amount: 50000, status: "PENDING" });
    expect(harness.auditEntries).toEqual([expect.objectContaining({ adminId: "admin-finance", action: "PAYMENT_REFUND_REQUESTED", subjectId: orderId })]);
  });

  it("the refund webhook completes it: order, refund row and original payment marked REFUNDED", async () => {
    const orderId = await paidCoinOrder();
    await refund(orderId);
    harness.cashfree.settleRefund(orderId, `rf_${orderId}`);
    await webhook(harness.cashfree.webhookRequest({ type: "REFUND_STATUS_WEBHOOK", data: { refund: { order_id: orderId, refund_id: `rf_${orderId}`, refund_amount: 500, refund_status: "SUCCESS" } } }));
    expect(await statusOf(orderId)).toBe("REFUNDED");
    expect((await harness.db.db.payment.findFirst({ where: { gatewayPaymentId: `refund:rf_${orderId}` } }))?.status).toBe("REFUNDED");
    expect((await harness.db.db.payment.findFirst({ where: { gatewayOrderId: orderId } }))?.status).toBe("REFUNDED");
    // Our own refund is not an incident.
    expect(loggedIncidents(errors).filter((d) => d.kind === "refund_processed")).toHaveLength(0);
  });

  it("a partial refund removes proportional coins and leaves the original payment SUCCESS", async () => {
    const orderId = await paidCoinOrder();
    expect((await refund(orderId, { amountInr: 200, reason: "Partial goodwill refund" })).status).toBe(200);
    expect(harness.db.balances.get("student-a")).toBe(300);
    expect((await harness.db.db.payment.findFirst({ where: { gatewayOrderId: orderId } }))?.status).toBe("SUCCESS");
  });

  it("is refused when the student has already spent the coins, with nothing sent to Cashfree", async () => {
    const orderId = await paidCoinOrder();
    harness.db.balances.set("student-a", 100);
    expect((await refund(orderId)).status).toBe(409);
    expect(refundCalls()).toHaveLength(0);
    expect(await statusOf(orderId)).toBe("PAID");
  });

  it("if Cashfree rejects the refund the order returns to PAID and the coins stay", async () => {
    const orderId = await paidCoinOrder();
    harness.cashfree.orders.get(orderId)!.payments[0]!.payment_amount = 1; // Cashfree will refuse anything above ₹1
    expect((await refund(orderId)).status).toBe(502);
    expect(await statusOf(orderId)).toBe("PAID");
    expect(harness.db.balances.get("student-a")).toBe(500);
  });

  it("a DUPLICATE recording payment is refunded without re-locking the recording", async () => {
    await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "booking-a", booking: { studentId: "student-a" }, isRecordingPaid: true } });
    const orderId = `rec_${Buffer.from(RECORDING.replaceAll("-", ""), "hex").toString("base64url")}_cccccccc`;
    await harness.cashfree.fetch("https://sandbox.cashfree.com/pg/orders", { method: "POST", headers: { "x-client-secret": "test-client-secret" }, body: JSON.stringify({ order_id: orderId, order_amount: 299, order_currency: "INR", customer_details: {} }) });
    harness.cashfree.pay(orderId, "SUCCESS");
    await harness.db.db.paymentOrder.create({ data: { orderId, receipt: orderId, userId: "student-a", amount: 299, status: "DUPLICATE", paymentId: "1000" } });

    expect((await refund(orderId)).status).toBe(200);
    expect(refundCalls()).toHaveLength(1);
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING } }))?.isRecordingPaid).toBe(true);
  });

  it("a full refund of a paid recording re-locks it", async () => {
    await harness.db.db.classSession.create({ data: { id: RECORDING, bookingId: "booking-a", booking: { studentId: "student-a" } } });
    const orderId = (await (await createRecordingOrder(jsonRequest("/api/students/payments/cashfree/order", { recordingId: RECORDING }))).json()).orderId;
    harness.cashfree.pay(orderId, "SUCCESS");
    await reconcilePaymentOrders(new Date(Date.now() + 20 * 60_000));
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING } }))?.isRecordingPaid).toBe(true);

    expect((await refund(orderId)).status).toBe(200);
    expect((await harness.db.db.classSession.findUnique({ where: { id: RECORDING } }))?.isRecordingPaid).toBe(false);
  });

  it("reconciliation completes a refund whose webhook was missed", async () => {
    const orderId = await paidCoinOrder();
    await refund(orderId);
    harness.cashfree.settleRefund(orderId, `rf_${orderId}`);
    const summary = await reconcilePaymentOrders(new Date(Date.now() + 20 * 60_000));
    expect(summary.refunded).toEqual([orderId]);
    expect(await statusOf(orderId)).toBe("REFUNDED");
  });
});

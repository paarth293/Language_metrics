import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createRecordingPaymentOrder, settleRecordingPayment, verifyRecordingPayment } from "./recording-payments";

const mocks = vi.hoisted(() => ({ session: vi.fn(), order: vi.fn(), openOrder: vi.fn(), create: vi.fn(), claim: vi.fn(), unlock: vi.fn(), payment: vi.fn(), transaction: vi.fn(), fetch: vi.fn() }));
vi.mock("@repo/database", () => ({ db: {
  classSession: { findFirst: mocks.session }, paymentOrder: { create: mocks.create, findUnique: mocks.order, findFirst: mocks.openOrder }, $transaction: mocks.transaction,
} }));
const sessionId = "11111111-1111-4111-8111-111111111111";
const receipt = `rec_${Buffer.from(sessionId.replaceAll("-", ""), "hex").toString("base64url")}_abcdef12`;
const order = { id: "saved-order", orderId: receipt, userId: "student", receipt, amount: 299, currency: "INR", status: "CREATED", paymentId: null };
const captured = { id: "pay_1", order_id: receipt, amount: 29900, currency: "INR", status: "SUCCESS" };
const tx = { paymentOrder: { findUnique: mocks.order, updateMany: mocks.claim }, classSession: { findFirst: mocks.session, updateMany: mocks.unlock }, payment: { create: mocks.payment } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("CASHFREE_CLIENT_ID", "test-key"); vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.session.mockResolvedValue({ id: sessionId, bookingId: "booking", isRecordingPaid: false });
  mocks.order.mockResolvedValue(order);
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.unlock.mockResolvedValue({ count: 1 });
  mocks.openOrder.mockResolvedValue(null);
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("recording purchases", () => {
  it("uses the server price and saves a receipt identifying the owned recording", async () => {
    mocks.fetch.mockImplementation(async (_url, init) => {
      const sent = JSON.parse(init.body);
      return { ok: true, json: async () => ({ order_id: sent.order_id, order_amount: sent.order_amount, order_currency: "INR", payment_session_id: "session_1" }) };
    });
    const result = await createRecordingPaymentOrder("student", sessionId);
    expect(result).toMatchObject({ amount: 299, paymentSessionId: "session_1", orderId: expect.stringMatching(/^rec_/) });
    expect(JSON.parse(mocks.fetch.mock.calls[0]?.[1].body)).toMatchObject({ order_amount: 299, order_currency: "INR" });
    expect(mocks.session).toHaveBeenCalledWith({ where: { id: sessionId, booking: { studentId: "student" }, recordingUrl: { not: null } } });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "student", amount: 299, receipt: expect.stringMatching(/^rec_/) }) });
  });

  it("rejects nonexistent or foreign recordings before creating an order", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(createRecordingPaymentOrder("student", sessionId)).rejects.toThrow("not found");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects a foreign order before contacting the provider", async () => {
    await expect(verifyRecordingPayment("other-student", { orderId: receipt })).rejects.toThrow("not found");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("settles only the payment Cashfree reports as successful", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ([
      { cf_payment_id: 7, payment_status: "FAILED", payment_amount: 299, payment_currency: "INR" },
      { cf_payment_id: 8, payment_status: "SUCCESS", payment_amount: 299, payment_currency: "INR" },
    ]) });
    await verifyRecordingPayment("student", { orderId: receipt });
    expect(mocks.claim).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "PAID", paymentId: "8" } }));
  });

  it("does not unlock while Cashfree has no successful payment", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ([{ cf_payment_id: 7, payment_status: "PENDING", payment_amount: 299, payment_currency: "INR" }]) });
    await expect(verifyRecordingPayment("student", { orderId: receipt })).rejects.toThrow("awaiting");
    expect(mocks.unlock).not.toHaveBeenCalled();
  });

  it.each([{ ...captured, status: "PENDING" }, { ...captured, amount: 1 }, { ...captured, currency: "USD" }])("rejects uncaptured or mismatched payment", async (payment) => {
    await expect(settleRecordingPayment(payment, "student")).rejects.toThrow();
    expect(mocks.unlock).not.toHaveBeenCalled();
  });

  it("commits the unlock and payment entry inside the order transaction", async () => {
    await settleRecordingPayment(captured, "student");
    expect(mocks.unlock).toHaveBeenCalledWith({ where: { id: sessionId, isRecordingPaid: false }, data: { isRecordingPaid: true } });
    expect(mocks.payment).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "RECORDING_FEE", amount: 29900, bookingId: "booking", gatewayPaymentId: "pay_1" }) });
  });

  it("does not unlock twice when a concurrent callback already claimed the order", async () => {
    mocks.claim.mockResolvedValue({ count: 0 });
    await settleRecordingPayment(captured);
    expect(mocks.unlock).not.toHaveBeenCalled();
    expect(mocks.payment).not.toHaveBeenCalled();
  });

  it("propagates payment-record failures so the unlock and order update roll back", async () => {
    mocks.payment.mockRejectedValue(new Error("database unavailable"));
    await expect(settleRecordingPayment(captured)).rejects.toThrow("database unavailable");
  });
});

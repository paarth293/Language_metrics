import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createRecordingPaymentOrder, settleRecordingPayment, verifyRecordingPayment } from "./recording-payments";

const mocks = vi.hoisted(() => ({ session: vi.fn(), order: vi.fn(), create: vi.fn(), claim: vi.fn(), unlock: vi.fn(), payment: vi.fn(), transaction: vi.fn(), fetch: vi.fn() }));
vi.mock("@repo/database", () => ({ db: {
  classSession: { findFirst: mocks.session }, razorpayOrder: { create: mocks.create, findUnique: mocks.order }, $transaction: mocks.transaction,
} }));
const sessionId = "11111111-1111-4111-8111-111111111111";
const receipt = `rec_${Buffer.from(sessionId.replaceAll("-", ""), "hex").toString("base64url")}_abcdef12`;
const order = { id: "saved-order", orderId: "order_1", userId: "student", receipt, amount: 299, currency: "INR", status: "CREATED", paymentId: null };
const captured = { id: "pay_1", order_id: "order_1", amount: 29900, currency: "INR", status: "captured" };
const tx = { razorpayOrder: { findUnique: mocks.order, updateMany: mocks.claim }, classSession: { findFirst: mocks.session, update: mocks.unlock }, payment: { create: mocks.payment } };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv("RAZORPAY_KEY_ID", "test-key"); vi.stubEnv("RAZORPAY_KEY_SECRET", "test-secret");
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.session.mockResolvedValue({ id: sessionId, bookingId: "booking", isRecordingPaid: false });
  mocks.order.mockResolvedValue(order);
  mocks.claim.mockResolvedValue({ count: 1 });
  mocks.transaction.mockImplementation(async (callback) => callback(tx));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("recording purchases", () => {
  it("uses the server price and saves a receipt identifying the owned recording", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "order_1", amount: 29900, currency: "INR" }) });
    const result = await createRecordingPaymentOrder("student", sessionId);
    expect(result.amount).toBe(29900);
    expect(mocks.session).toHaveBeenCalledWith({ where: { id: sessionId, booking: { studentId: "student" }, recordingUrl: { not: null } } });
    expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ userId: "student", amount: 299, receipt: expect.stringMatching(/^rec_/) }) });
  });

  it("rejects nonexistent or foreign recordings before creating an order", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(createRecordingPaymentOrder("student", sessionId)).rejects.toThrow("not found");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("rejects a foreign signed order before contacting the provider", async () => {
    await expect(verifyRecordingPayment("other-student", { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "a".repeat(64) })).rejects.toThrow("not found");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it.each([{ ...captured, status: "authorized" }, { ...captured, amount: 1 }, { ...captured, currency: "USD" }])("rejects uncaptured or mismatched payment", async (payment) => {
    await expect(settleRecordingPayment(payment, "student")).rejects.toThrow();
    expect(mocks.unlock).not.toHaveBeenCalled();
  });

  it("commits the unlock and payment entry inside the order transaction", async () => {
    await settleRecordingPayment(captured, "student");
    expect(mocks.unlock).toHaveBeenCalledWith({ where: { id: sessionId }, data: { isRecordingPaid: true } });
    expect(mocks.payment).toHaveBeenCalledWith({ data: expect.objectContaining({ type: "RECORDING_FEE", amount: 29900, bookingId: "booking" }) });
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

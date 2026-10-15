import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), verify: vi.fn(), settle: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@/lib/db", () => ({ db: { razorpayOrder: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/razorpay-verify", () => ({ verifyRazorpaySignature: mocks.verify }));
vi.mock("@/lib/payment-settlement", () => ({ PaymentError: class extends Error {}, settlePayment: mocks.settle }));

const body = { razorpay_order_id: "order_1", razorpay_payment_id: "pay_1", razorpay_signature: "signed", coinsToCredit: 999999 };
const request = () => new Request("https://example.test/api/payments/verify-payment", { method: "POST", body: JSON.stringify(body) });
const payment = { id: "pay_1", order_id: "order_1", amount: 29900, currency: "INR", status: "captured" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  mocks.findUnique.mockResolvedValue({ orderId: "order_1", userId: "student" });
  mocks.verify.mockReturnValue(true);
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => payment });
});
afterEach(() => vi.unstubAllGlobals());

describe("payment confirmation", () => {
  it("rejects another student's order before verifying or crediting it", async () => {
    mocks.findUnique.mockResolvedValue({ orderId: "order_1", userId: "other-student" });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it("passes only the provider-confirmed payment to settlement, ignoring injected coins", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.settle).toHaveBeenCalledWith(payment, "student", "signed");
  });

  it("rejects a provider payment belonging to another order", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ ...payment, order_id: "other-order" }) });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});

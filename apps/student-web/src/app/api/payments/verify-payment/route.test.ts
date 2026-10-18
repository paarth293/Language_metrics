import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), settle: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@/lib/db", () => ({ db: { paymentOrder: { findUnique: mocks.findUnique } } }));
vi.mock("@/lib/payment-settlement", () => ({ PaymentError: class extends Error {}, settlePayment: mocks.settle }));

const body = { orderId: "coins_100_abc", coinsToCredit: 999999 };
const request = () => new Request("https://example.test/api/payments/verify-payment", { method: "POST", body: JSON.stringify(body) });
const providerPayment = { cf_payment_id: 42, payment_status: "SUCCESS", payment_amount: 100, payment_currency: "INR" };

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal("fetch", mocks.fetch);
  vi.stubEnv("CASHFREE_CLIENT_ID", "test-key"); vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret");
  mocks.findUnique.mockResolvedValue({ orderId: "coins_100_abc", userId: "student" });
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => [providerPayment] });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("payment confirmation", () => {
  it("rejects another student's order before contacting Cashfree or crediting it", async () => {
    mocks.findUnique.mockResolvedValue({ orderId: "coins_100_abc", userId: "other-student" });
    expect((await POST(request())).status).toBe(404);
    expect(mocks.fetch).not.toHaveBeenCalled();
    expect(mocks.settle).not.toHaveBeenCalled();
  });

  it("passes only the provider-confirmed payment to settlement, ignoring injected coins", async () => {
    expect((await POST(request())).status).toBe(200);
    expect(mocks.settle).toHaveBeenCalledWith({ id: "42", order_id: "coins_100_abc", amount: 10000, currency: "INR", status: "SUCCESS" }, "student");
  });

  it("waits while Cashfree has no successful payment for the order", async () => {
    mocks.fetch.mockResolvedValue({ ok: true, json: async () => [{ ...providerPayment, payment_status: "PENDING" }] });
    expect((await POST(request())).status).toBe(409);
    expect(mocks.settle).not.toHaveBeenCalled();
  });
});

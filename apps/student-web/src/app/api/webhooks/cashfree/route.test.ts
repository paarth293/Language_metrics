import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ settle: vi.fn(), settleRecording: vi.fn() }));
vi.mock("@/lib/payment-settlement", () => ({ PaymentError: class extends Error {}, settlePayment: mocks.settle }));
vi.mock("@repo/live-classes", async (importActual) => ({
  ...(await importActual<typeof import("@repo/live-classes")>()), settleRecordingPayment: mocks.settleRecording,
}));

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret"); });
afterEach(() => vi.unstubAllEnvs());

const event = (orderId: string) => JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: {
  order: { order_id: orderId },
  payment: { cf_payment_id: 42, payment_status: "SUCCESS", payment_amount: 100, payment_currency: "INR" },
} });
const signed = (raw: string, secret = "test-secret") => new Request("https://example.test/api/webhooks/cashfree", {
  method: "POST", body: raw, headers: {
    "x-webhook-timestamp": "1700000000000",
    "x-webhook-signature": createHmac("sha256", secret).update("1700000000000" + raw).digest("base64"),
  },
});

it("rejects webhooks not signed with the client secret", async () => {
  expect((await POST(signed(event("coins_100_abc"), "wrong-secret"))).status).toBe(400);
  expect(mocks.settle).not.toHaveBeenCalled();
});

it("credits coin orders and unlocks recording orders by order prefix", async () => {
  expect((await POST(signed(event("coins_100_abc")))).status).toBe(200);
  expect(mocks.settle).toHaveBeenCalledWith(expect.objectContaining({ order_id: "coins_100_abc", amount: 10000 }));
  expect((await POST(signed(event("rec_abc")))).status).toBe(200);
  expect(mocks.settleRecording).toHaveBeenCalledWith(expect.objectContaining({ order_id: "rec_abc" }));
});

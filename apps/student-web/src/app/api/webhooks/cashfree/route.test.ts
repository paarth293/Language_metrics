import { createHmac } from "node:crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ handle: vi.fn() }));
vi.mock("@repo/live-classes", async (importActual) => ({
  ...(await importActual<typeof import("@repo/live-classes")>()), handleCashfreeWebhook: mocks.handle,
}));

beforeEach(() => { vi.resetAllMocks(); mocks.handle.mockResolvedValue({}); vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret"); });
afterEach(() => vi.unstubAllEnvs());

const event = (orderId: string) => JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: {
  order: { order_id: orderId },
  payment: { cf_payment_id: 42, payment_status: "SUCCESS", payment_amount: 100, payment_currency: "INR" },
} });
const FRESH = String(Date.now());
const signed = (raw: string, secret = "test-secret") => new Request("https://example.test/api/webhooks/cashfree", {
  method: "POST", body: raw, headers: {
    "x-webhook-timestamp": FRESH,
    "x-webhook-signature": createHmac("sha256", secret).update(FRESH + raw).digest("base64"),
  },
});

it("rejects webhooks not signed with the client secret", async () => {
  expect((await POST(signed(event("coins_100_abc"), "wrong-secret"))).status).toBe(400);
  expect(mocks.handle).not.toHaveBeenCalled();
});

it("hands the verified event to the shared handler", async () => {
  expect((await POST(signed(event("coins_100_abc")))).status).toBe(200);
  expect(mocks.handle).toHaveBeenCalledWith(JSON.parse(event("coins_100_abc")));
});

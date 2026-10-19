import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// #8e: payment routes that keep answering 5xx raise one ops alert (3 within
// 5 minutes), instead of failing quietly.
class CashfreeError extends Error { constructor(message: string, public status: number) { super(message); } }
class PaymentError extends CashfreeError {}
class RecordingPaymentError extends CashfreeError {}
const down = async () => { throw new Error("Can't reach database server"); };
vi.mock("@repo/live-classes", () => ({
  CashfreeError, PaymentError, RecordingPaymentError,
  createCoinPaymentOrder: down, verifyCoinPayment: down,
  createRecordingPaymentOrder: down, verifyRecordingPayment: down,
  handleCashfreeWebhook: down, verifyCashfreeWebhook: () => true,
}));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@/lib/rate-limit", () => ({ rateLimitRedis: async () => false }));

let alerts: { kind: string; detail: { scope: string } }[] = [];

beforeEach(() => {
  vi.resetModules();
  alerts = [];
  vi.stubEnv("OPS_ALERT_WEBHOOK_URL", "https://hooks.example.test/ops");
  vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
    alerts.push(JSON.parse(String(init.body)));
    return new Response(null, { status: 200 });
  }));
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const body = JSON.stringify({ packageId: "tier1", orderId: "o1", recordingId: "r1" });
const request = () =>
  new Request("https://example.test/x", {
    method: "POST",
    body,
    headers: { "x-webhook-signature": "sig", "x-webhook-timestamp": "1", "content-type": "application/json" },
  });

describe.each([
  ["payments/create-order", () => import("./create-order/route")],
  ["payments/verify-payment", () => import("./verify-payment/route")],
  ["students/payments/cashfree/order", () => import("../students/payments/cashfree/order/route")],
  ["students/payments/cashfree/verify", () => import("../students/payments/cashfree/verify/route")],
  ["webhooks/cashfree", () => import("../webhooks/cashfree/route")],
] as const)("POST /api/%s", (route, load) => {
  it("sends one payment_5xx alert after 3 server errors", async () => {
    const { POST } = await load();
    for (let i = 0; i < 3; i++) expect((await POST(request())).status).toBe(500);
    expect(alerts).toEqual([expect.objectContaining({ kind: "payment_5xx", detail: expect.objectContaining({ scope: `student-web ${route}` }) })]);
  });
});

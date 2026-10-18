import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@/lib/db", () => ({ db: { paymentOrder: { create: mocks.create } } }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch); vi.stubEnv("CASHFREE_CLIENT_ID", "test-key"); vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = (body: unknown) => new Request("https://example.test/order", { method: "POST", body: JSON.stringify(body) });

it.each([{ packageId: "tier3", amount: 1 }, { amount: -100 }, { packageId: "tier1", currency: "USD" }])("rejects tampered package prices and currency", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("saves a server-defined package and coin snapshot at 1 coin = ₹1", async () => {
  mocks.fetch.mockImplementation(async (_url, init) => {
    const sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ order_id: sent.order_id, order_amount: sent.order_amount, order_currency: "INR", payment_session_id: "session_1" }) };
  });
  const response = await POST(request({ packageId: "tier1" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ paymentSessionId: "session_1", orderId: expect.stringMatching(/^coins_100_/) });
  expect(JSON.parse(mocks.fetch.mock.calls[0]?.[1].body)).toMatchObject({ order_amount: 100, order_currency: "INR", customer_details: { customer_id: "student" } });
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 100, userId: "student", receipt: expect.stringMatching(/^coins_100_/), status: "CREATED" }) });
});

it("reports payments as unavailable without Cashfree credentials", async () => {
  vi.stubEnv("CASHFREE_CLIENT_SECRET", "");
  expect((await POST(request({ packageId: "tier1" }))).status).toBe(503);
  expect(mocks.create).not.toHaveBeenCalled();
});

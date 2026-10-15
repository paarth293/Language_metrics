import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ create: vi.fn(), fetch: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@/lib/db", () => ({ db: { razorpayOrder: { create: mocks.create } } }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal("fetch", mocks.fetch); vi.stubEnv("RAZORPAY_KEY_ID", "test-key"); vi.stubEnv("RAZORPAY_KEY_SECRET", "test-secret"); });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const request = (body: unknown) => new Request("https://example.test/order", { method: "POST", body: JSON.stringify(body) });

it.each([{ packageId: "tier3", amount: 1 }, { amount: -100 }, { packageId: "tier1", currency: "USD" }])("rejects tampered package prices and currency", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.fetch).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
});

it("saves a server-defined package and coin snapshot", async () => {
  mocks.fetch.mockResolvedValue({ ok: true, json: async () => ({ id: "order_1", amount: 29900, currency: "INR" }) });
  expect((await POST(request({ packageId: "tier1" }))).status).toBe(200);
  expect(mocks.create).toHaveBeenCalledWith({ data: expect.objectContaining({ amount: 299, userId: "student", receipt: expect.stringMatching(/^coins_100_/), status: "CREATED" }) });
});

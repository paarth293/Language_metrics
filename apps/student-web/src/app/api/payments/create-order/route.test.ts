import { beforeEach, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ createOrder: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@repo/live-classes", async (importActual) => ({
  ...(await importActual<typeof import("@repo/live-classes")>()), createCoinPaymentOrder: mocks.createOrder,
}));
beforeEach(() => { vi.resetAllMocks(); mocks.createOrder.mockResolvedValue({ orderId: "coins_100_x", paymentSessionId: "s", mode: "sandbox" }); });
const request = (body: unknown) => new Request("https://example.test/order", { method: "POST", body: JSON.stringify(body) });

it.each([{ packageId: "tier3", amount: 1 }, { amount: -100 }, { packageId: "tier1", currency: "USD" }])("rejects tampered package prices and currency", async (body) => {
  expect((await POST(request(body))).status).toBe(400);
  expect(mocks.createOrder).not.toHaveBeenCalled();
});

it("opens the order for the server-defined pack at 1 coin = ₹1", async () => {
  const response = await POST(request({ packageId: "tier1", coins: 999999 }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ orderId: "coins_100_x", paymentSessionId: "s", mode: "sandbox" });
  expect(mocks.createOrder).toHaveBeenCalledWith("student", expect.objectContaining({ id: "tier1", coins: 100, priceInr: 100 }));
});

it("reports payments as unavailable when Cashfree is not configured", async () => {
  const { CashfreeError } = await import("@repo/live-classes");
  mocks.createOrder.mockRejectedValue(new CashfreeError("Payments are unavailable", 503));
  expect((await POST(request({ packageId: "tier1" }))).status).toBe(503);
});

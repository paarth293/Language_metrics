import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireAuth: async () => ({ user: { sub: "student" } }) }));
vi.mock("@repo/live-classes", async (importActual) => ({
  ...(await importActual<typeof import("@repo/live-classes")>()), verifyCoinPayment: mocks.verify,
}));
beforeEach(() => vi.resetAllMocks());
const request = (body: unknown) => new Request("https://example.test/api/payments/verify-payment", { method: "POST", body: JSON.stringify(body) });

describe("payment confirmation route", () => {
  it("confirms only the named order for the signed-in student, ignoring injected coins", async () => {
    mocks.verify.mockResolvedValue(undefined);
    expect((await POST(request({ orderId: "coins_100_abc", coinsToCredit: 999999 }))).status).toBe(200);
    expect(mocks.verify).toHaveBeenCalledWith("student", "coins_100_abc");
  });

  it.each([[404, "Order not found"], [409, "Payment is awaiting confirmation."], [400, "Payment does not match the order"]])("passes a %s from settlement through", async (status, message) => {
    const { PaymentError } = await import("@repo/live-classes");
    mocks.verify.mockRejectedValue(new PaymentError(message, status));
    const response = await POST(request({ orderId: "coins_100_abc" }));
    expect(response.status).toBe(status);
    expect((await response.json()).error).toBe(message);
  });

  it("rejects a malformed body", async () => {
    const response = await POST(new Request("https://example.test/x", { method: "POST", body: "{" }));
    expect(response.status).toBe(400);
    expect(mocks.verify).not.toHaveBeenCalled();
  });
});

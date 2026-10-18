import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCashfreeOrder, paymentFromWebhook, verifyCashfreeWebhook } from "./cashfree";

const fetchMock = vi.fn();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("CASHFREE_CLIENT_ID", "test-id");
  vi.stubEnv("CASHFREE_CLIENT_SECRET", "test-secret");
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("cashfree orders", () => {
  it("refuses to create orders without credentials", async () => {
    vi.stubEnv("CASHFREE_CLIENT_SECRET", "");
    await expect(createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" })).rejects.toThrow("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("uses the sandbox unless production is configured", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ order_id: "coins_1", order_amount: 100, order_currency: "INR", payment_session_id: "s" }) });
    await createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sandbox.cashfree.com/pg/orders");
    vi.stubEnv("CASHFREE_ENV", "production");
    await createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.cashfree.com/pg/orders");
  });

  it("rejects an order whose amount the provider changed", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ order_id: "coins_1", order_amount: 1, order_currency: "INR", payment_session_id: "s" }) });
    await expect(createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" })).rejects.toThrow("invalid order");
  });
});

describe("cashfree webhooks", () => {
  const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: {
    order: { order_id: "coins_100_abc" },
    payment: { cf_payment_id: 42, payment_status: "SUCCESS", payment_amount: 100, payment_currency: "INR" },
  } });
  const sign = (timestamp: string, raw: string) => createHmac("sha256", "test-secret").update(timestamp + raw).digest("base64");

  it("accepts only bodies signed with the client secret", () => {
    expect(verifyCashfreeWebhook(body, sign("1700000000000", body), "1700000000000")).toBe(true);
    expect(verifyCashfreeWebhook(body + " ", sign("1700000000000", body), "1700000000000")).toBe(false);
    expect(verifyCashfreeWebhook(body, sign("1700000000001", body), "1700000000000")).toBe(false);
    expect(verifyCashfreeWebhook(body, "not-a-signature", "1700000000000")).toBe(false);
  });

  it("normalises the successful payment to paise", () => {
    expect(paymentFromWebhook(JSON.parse(body))).toEqual({ id: "42", order_id: "coins_100_abc", amount: 10000, currency: "INR", status: "SUCCESS" });
  });

  it("ignores events that are not successful payments", () => {
    const failed = JSON.parse(body);
    failed.type = "PAYMENT_FAILED_WEBHOOK";
    failed.data.payment.payment_status = "FAILED";
    expect(paymentFromWebhook(failed)).toBeNull();
    expect(paymentFromWebhook({ type: "PAYMENT_CHARGES_WEBHOOK", data: {} })).toBeNull();
  });

  it("rejects a recognised event it cannot read", () => {
    expect(() => paymentFromWebhook({ type: "PAYMENT_FAILED_WEBHOOK", data: {} })).toThrow("Invalid payment details");
  });
});

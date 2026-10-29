import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCashfreeOrder, paymentFromWebhook, verifyCashfreeWebhook, webhookTimestampFresh } from "./cashfree";

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

  it("refuses to guess the gateway when CASHFREE_ENV is missing or unknown", async () => {
    for (const value of ["", "prod", "Production"]) {
      vi.stubEnv("CASHFREE_ENV", value);
      await expect(createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" })).rejects.toThrow("unavailable");
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refuses production mode with a test-mode client id", async () => {
    vi.stubEnv("CASHFREE_ENV", "production");
    vi.stubEnv("CASHFREE_CLIENT_ID", "TEST1234567890");
    await expect(createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" })).rejects.toThrow("unavailable");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("calls the gateway CASHFREE_ENV names", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ order_id: "coins_1", order_amount: 100, order_currency: "INR", payment_session_id: "s" }) });
    vi.stubEnv("CASHFREE_ENV", "sandbox");
    await createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://sandbox.cashfree.com/pg/orders");
    vi.stubEnv("CASHFREE_ENV", "production");
    await createCashfreeOrder({ orderId: "coins_1", amountInr: 100, customerId: "student" });
    expect(fetchMock.mock.calls[1]?.[0]).toBe("https://api.cashfree.com/pg/orders");
  });

  it("rejects an order whose amount the provider changed", async () => {
    vi.stubEnv("CASHFREE_ENV", "sandbox");
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

describe("webhook timestamp freshness (#37)", () => {
  const NOW = 1_700_000_000_000;

  it("accepts a timestamp from the last 5 minutes, in seconds or milliseconds", () => {
    expect(webhookTimestampFresh(String(NOW), NOW)).toBe(true);
    expect(webhookTimestampFresh(String(NOW / 1000), NOW)).toBe(true);
    expect(webhookTimestampFresh(String(NOW - 4 * 60_000), NOW)).toBe(true);
  });

  it("rejects anything older than 5 minutes", () => {
    expect(webhookTimestampFresh(String(NOW - 5 * 60_000 - 1), NOW)).toBe(false);
    expect(webhookTimestampFresh(String(NOW / 1000 - 600), NOW)).toBe(false);
    expect(webhookTimestampFresh("1", NOW)).toBe(false);
  });

  it("allows a minute of clock skew but not a far-future stamp", () => {
    expect(webhookTimestampFresh(String(NOW + 30_000), NOW)).toBe(true);
    expect(webhookTimestampFresh(String(NOW + 10 * 60_000), NOW)).toBe(false);
  });

  it("rejects a missing or unparsable timestamp", () => {
    for (const bad of ["", "not-a-number", "0", "-1", "NaN"]) {
      expect(webhookTimestampFresh(bad, NOW)).toBe(false);
    }
  });
});

import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side Cashfree Payment Gateway client shared by coin top-ups and
 * recording unlocks. Every confirmation is fetched from Cashfree (or arrives
 * as a signed webhook); nothing the browser reports is trusted.
 */

const API_VERSION = "2023-08-01";
// Cashfree requires a customer phone number, which accounts do not collect yet.
const PLACEHOLDER_PHONE = "9999999999";

export type CashfreeMode = "sandbox" | "production";

export class CashfreeError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

/** A provider-confirmed payment, normalised so amounts are in paise. */
export interface GatewayPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

export function cashfreeMode(): CashfreeMode {
  return process.env.CASHFREE_ENV === "production" ? "production" : "sandbox";
}

function cashfreeConfig() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new CashfreeError("Payments are unavailable", 503);
  const baseUrl = cashfreeMode() === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
  return {
    baseUrl,
    headers: {
      "Content-Type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": clientId,
      "x-client-secret": clientSecret,
    },
  };
}

export async function createCashfreeOrder(input: { orderId: string; amountInr: number; customerId: string }) {
  const { baseUrl, headers } = cashfreeConfig();
  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST", headers,
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amountInr,
      order_currency: "INR",
      customer_details: { customer_id: input.customerId, customer_phone: PLACEHOLDER_PHONE },
    }),
  });
  if (!response.ok) {
    console.error("Cashfree order error:", await response.json().catch(() => null));
    throw new CashfreeError("Payment provider error", 502);
  }
  const order = (await response.json()) as Partial<Record<"order_id" | "order_amount" | "order_currency" | "payment_session_id", unknown>> | null;
  if (!order || order.order_id !== input.orderId || order.order_amount !== input.amountInr
      || order.order_currency !== "INR" || typeof order.payment_session_id !== "string") {
    throw new CashfreeError("Payment provider returned an invalid order", 502);
  }
  return { orderId: input.orderId, paymentSessionId: order.payment_session_id, mode: cashfreeMode() };
}

/** Normalise a Cashfree payment entity (API or webhook) for settlement. */
export function toGatewayPayment(entity: unknown, orderId: string): GatewayPayment | null {
  if (!entity || typeof entity !== "object") return null;
  const data = entity as Record<string, unknown>;
  const id = data.cf_payment_id;
  if ((typeof id !== "string" && typeof id !== "number") || typeof data.payment_amount !== "number"
      || typeof data.payment_currency !== "string" || typeof data.payment_status !== "string") return null;
  return {
    id: String(id), order_id: orderId, amount: Math.round(data.payment_amount * 100),
    currency: data.payment_currency, status: data.payment_status,
  };
}

/** Return the order's successful payment, or null while none has succeeded. */
export async function fetchSuccessfulPayment(orderId: string): Promise<GatewayPayment | null> {
  const { baseUrl, headers } = cashfreeConfig();
  // Next.js caches fetch by default; a confirmation must always be fresh.
  const request = { headers, cache: "no-store" as const };
  const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, request);
  if (!response.ok) throw new CashfreeError("Payment confirmation is unavailable. Please try again.", 502);
  const payments = await response.json();
  if (!Array.isArray(payments)) throw new CashfreeError("Payment provider returned an invalid response", 502);
  const success = payments.find((entry) => entry?.payment_status === "SUCCESS");
  return success ? toGatewayPayment(success, orderId) : null;
}

export type CashfreeOrderStatus = "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED" | "TERMINATION_REQUESTED";

/** Cashfree's view of an order: whether it can still be paid, and its checkout session. */
export async function fetchCashfreeOrder(orderId: string): Promise<{ status: CashfreeOrderStatus; paymentSessionId: string | null }> {
  const { baseUrl, headers } = cashfreeConfig();
  const request = { headers, cache: "no-store" as const };
  const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, request);
  if (!response.ok) throw new CashfreeError("Payment confirmation is unavailable. Please try again.", 502);
  const order = (await response.json()) as Partial<Record<"order_id" | "order_status" | "payment_session_id", unknown>> | null;
  if (!order || order.order_id !== orderId || typeof order.order_status !== "string") {
    throw new CashfreeError("Payment provider returned an invalid response", 502);
  }
  return {
    status: order.order_status as CashfreeOrderStatus,
    paymentSessionId: typeof order.payment_session_id === "string" ? order.payment_session_id : null,
  };
}

/** Cashfree signs webhooks as base64(HMAC-SHA256(timestamp + rawBody, client secret)). */
export function verifyCashfreeWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.CASHFREE_CLIENT_SECRET;
  if (!secret) throw new CashfreeError("Payments are unavailable", 503);
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(expected, received);
}

/** Extract the successful payment from a verified webhook body, if it carries one. */
export function paymentFromWebhook(payload: unknown): GatewayPayment | null {
  if (!payload || typeof payload !== "object") return null;
  const body = payload as { type?: unknown; data?: { order?: { order_id?: unknown }; payment?: unknown } };
  if (body.type !== "PAYMENT_SUCCESS_WEBHOOK") return null;
  const orderId = body.data?.order?.order_id;
  if (typeof orderId !== "string" || !orderId) throw new CashfreeError("Invalid payment details", 400);
  const payment = toGatewayPayment(body.data?.payment, orderId);
  if (!payment) throw new CashfreeError("Invalid payment details", 400);
  return payment;
}

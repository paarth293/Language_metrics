import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Server-side Cashfree Payment Gateway client shared by coin top-ups and
 * recording unlocks. Every confirmation is fetched from Cashfree (or arrives
 * as a signed webhook); nothing the browser reports is trusted.
 */

const API_VERSION = "2023-08-01";
// Cashfree requires a customer phone number, which accounts do not collect yet.
const PLACEHOLDER_PHONE = "9999999999";
/**
 * Cashfree keeps an order payable for 30 days unless told otherwise. A short
 * expiry lets reconciliation mark abandoned checkouts EXPIRED instead of
 * watching them as "stuck" for weeks.
 */
const ORDER_TTL_MS = 30 * 60_000;

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

/**
 * The gateway must be chosen explicitly: a missing or misspelt CASHFREE_ENV
 * used to fall back to sandbox, which in production takes "payments" that
 * never charge anyone.
 */
export function cashfreeMode(): CashfreeMode {
  const mode = process.env.CASHFREE_ENV;
  if (mode === "production" || mode === "sandbox") return mode;
  console.error(`[payments] CASHFREE_ENV must be "production" or "sandbox", got ${mode ? JSON.stringify(mode) : "nothing"}`);
  throw new CashfreeError("Payments are unavailable", 503);
}

function cashfreeConfig() {
  const clientId = process.env.CASHFREE_CLIENT_ID;
  const clientSecret = process.env.CASHFREE_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new CashfreeError("Payments are unavailable", 503);
  const mode = cashfreeMode();
  // Cashfree test-mode app ids start with "TEST"; production ones never do.
  if (mode === "production" && clientId.startsWith("TEST")) {
    console.error("[payments] CASHFREE_ENV is production but CASHFREE_CLIENT_ID is a test-mode key");
    throw new CashfreeError("Payments are unavailable", 503);
  }
  const baseUrl = mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
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

/**
 * GET with one retry on a network error or 5xx. Only for reads: they are
 * idempotent, so asking twice cannot change anything at Cashfree.
 */
async function getWithRetry(url: string, init: { headers: Record<string, string>; cache: "no-store" }): Promise<Response> {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url, init);
      if (response.status < 500 || attempt === 2) return response;
    } catch (error) {
      if (attempt === 2) throw new CashfreeError("Payment provider is unreachable. Please try again.", 502);
      console.error("Cashfree request failed, retrying:", error instanceof Error ? error.message : error);
    }
  }
}

export async function createCashfreeOrder(input: { orderId: string; amountInr: number; customerId: string }) {
  const { baseUrl, headers } = cashfreeConfig();
  const response = await fetch(`${baseUrl}/orders`, {
    method: "POST", headers,
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amountInr,
      order_currency: "INR",
      order_expiry_time: new Date(Date.now() + ORDER_TTL_MS).toISOString(),
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
  const response = await getWithRetry(`${baseUrl}/orders/${encodeURIComponent(orderId)}/payments`, request);
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
  const response = await getWithRetry(`${baseUrl}/orders/${encodeURIComponent(orderId)}`, request);
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

export type CashfreeRefundStatus = "PENDING" | "SUCCESS" | "CANCELLED" | "ONHOLD";

export async function fetchCashfreeRefund(orderId: string, refundId: string): Promise<{ status: CashfreeRefundStatus }> {
  const { baseUrl, headers } = cashfreeConfig();
  const request = { headers, cache: "no-store" as const };
  const response = await getWithRetry(`${baseUrl}/orders/${encodeURIComponent(orderId)}/refunds/${encodeURIComponent(refundId)}`, request);
  if (!response.ok) throw new CashfreeError("Refund status is unavailable. Please try again.", 502);
  const refund = (await response.json()) as Partial<Record<"refund_id" | "refund_status", unknown>> | null;
  if (!refund || refund.refund_id !== refundId || typeof refund.refund_status !== "string") {
    throw new CashfreeError("Payment provider returned an invalid response", 502);
  }
  return { status: refund.refund_status as CashfreeRefundStatus };
}

/**
 * Ask Cashfree to refund part or all of an order. `refundId` is ours and
 * deterministic, so repeating the call cannot refund twice: Cashfree rejects a
 * reused refund_id and we read back the refund it already has.
 */
export async function createCashfreeRefund(input: { orderId: string; refundId: string; amountInr: number; note: string }): Promise<{ status: CashfreeRefundStatus }> {
  const { baseUrl, headers } = cashfreeConfig();
  const response = await fetch(`${baseUrl}/orders/${encodeURIComponent(input.orderId)}/refunds`, {
    method: "POST", headers,
    body: JSON.stringify({ refund_id: input.refundId, refund_amount: input.amountInr, refund_note: input.note.slice(0, 100) }),
  });
  if (response.status === 409) return fetchCashfreeRefund(input.orderId, input.refundId);
  if (!response.ok) {
    console.error("Cashfree refund error:", await response.json().catch(() => null));
    throw new CashfreeError("Cashfree did not accept the refund", 502);
  }
  const refund = (await response.json()) as Partial<Record<"refund_id" | "refund_status", unknown>> | null;
  if (!refund || refund.refund_id !== input.refundId || typeof refund.refund_status !== "string") {
    throw new CashfreeError("Payment provider returned an invalid response", 502);
  }
  return { status: refund.refund_status as CashfreeRefundStatus };
}

/** Cashfree signs webhooks as base64(HMAC-SHA256(timestamp + rawBody, client secret)). */
export function verifyCashfreeWebhook(rawBody: string, signature: string, timestamp: string): boolean {
  const secret = process.env.CASHFREE_CLIENT_SECRET;
  if (!secret) throw new CashfreeError("Payments are unavailable", 503);
  const expected = createHmac("sha256", secret).update(timestamp + rawBody).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(expected, received);
}

export type CashfreeWebhookEvent =
  | { kind: "payment_success"; payment: GatewayPayment }
  | { kind: "payment_failed"; type: string; payment: GatewayPayment }
  | { kind: "refund"; orderId: string; refundId: string; amountInr: number | null; status: string }
  | { kind: "dispute"; type: string; orderId: string | null; disputeId: string; disputeType: string | null; amountInr: number | null; status: string | null; respondBy: string | null }
  | { kind: "ignored"; type: string };

const PAYMENT_FAILURE_TYPES = new Set(["PAYMENT_FAILED_WEBHOOK", "PAYMENT_USER_DROPPED_WEBHOOK"]);
const DISPUTE_TYPES = new Set(["DISPUTE_CREATED", "DISPUTE_UPDATED", "DISPUTE_CLOSED"]);

const text = (value: unknown) => (typeof value === "string" && value ? value : null);
const amount = (value: unknown) => (typeof value === "number" ? value : null);

/**
 * Classify a verified webhook body (API version 2023-08-01). Event shapes per
 * Cashfree's payment, refund and dispute webhook docs. A recognised event with
 * a malformed body throws, because a signed event we cannot read is a bug.
 */
export function parseCashfreeWebhook(payload: unknown): CashfreeWebhookEvent {
  const body = (payload && typeof payload === "object" ? payload : {}) as { type?: unknown; data?: Record<string, any> };
  const type = typeof body.type === "string" ? body.type : "";
  const data = body.data ?? {};
  const invalid = () => new CashfreeError("Invalid payment details", 400);

  if (type === "PAYMENT_SUCCESS_WEBHOOK" || PAYMENT_FAILURE_TYPES.has(type)) {
    const orderId = text(data.order?.order_id);
    const payment = orderId ? toGatewayPayment(data.payment, orderId) : null;
    if (!payment) throw invalid();
    return type === "PAYMENT_SUCCESS_WEBHOOK" ? { kind: "payment_success", payment } : { kind: "payment_failed", type, payment };
  }
  if (type === "REFUND_STATUS_WEBHOOK") {
    const orderId = text(data.refund?.order_id);
    const refundId = text(data.refund?.refund_id);
    const status = text(data.refund?.refund_status);
    if (!orderId || !refundId || !status) throw invalid();
    return { kind: "refund", orderId, refundId, amountInr: amount(data.refund?.refund_amount), status };
  }
  if (DISPUTE_TYPES.has(type)) {
    const disputeId = data.dispute?.dispute_id;
    if (typeof disputeId !== "string" && typeof disputeId !== "number") throw invalid();
    return {
      kind: "dispute", type, orderId: text(data.order_details?.order_id), disputeId: String(disputeId),
      disputeType: text(data.dispute?.dispute_type), amountInr: amount(data.dispute?.dispute_amount),
      status: text(data.dispute?.dispute_status), respondBy: text(data.dispute?.respond_by),
    };
  }
  return { kind: "ignored", type };
}

/** Extract the successful payment from a verified webhook body, if it carries one. */
export function paymentFromWebhook(payload: unknown): GatewayPayment | null {
  const event = parseCashfreeWebhook(payload);
  return event.kind === "payment_success" ? event.payment : null;
}

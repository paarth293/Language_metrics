import { createHmac } from "node:crypto";

/**
 * A fake Cashfree PG (API version 2023-08-01) behind a `fetch` stub.
 *
 * It answers only the endpoints the app calls and keeps orders, payments and
 * refunds in memory. Responses follow Cashfree's documented shapes; anything
 * not modelled returns 404 so an unexpected call fails loudly.
 */

export type PaymentStatus = "SUCCESS" | "FAILED" | "PENDING" | "USER_DROPPED" | "NOT_ATTEMPTED" | "CANCELLED" | "VOID";

interface FakeOrder {
  order_id: string;
  order_amount: number;
  order_currency: string;
  order_status: "ACTIVE" | "PAID" | "EXPIRED" | "TERMINATED";
  payment_session_id: string;
  customer_details: Record<string, unknown>;
  payments: Array<{ cf_payment_id: number; payment_status: PaymentStatus; payment_amount: number; payment_currency: string; payment_group: string }>;
  refunds: Array<{ refund_id: string; refund_amount: number; refund_status: "PENDING" | "SUCCESS" | "CANCELLED" }>;
}

export const TEST_SECRET = "test-client-secret";

export function createFakeCashfree() {
  const orders = new Map<string, FakeOrder>();
  const calls: Array<{ method: string; path: string }> = [];
  let nextPaymentId = 1000;

  const json = (status: number, body: unknown) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

  async function fetchStub(input: string | URL, init: RequestInit = {}) {
    const url = new URL(String(input));
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.pathname.replace(/^\/pg/, "");
    calls.push({ method, path });
    const headers = new Headers(init.headers);
    if (headers.get("x-client-secret") !== TEST_SECRET) return json(401, { message: "authentication Failed", code: "request_failed" });

    if (method === "POST" && path === "/orders") {
      const body = JSON.parse(String(init.body));
      if (orders.has(body.order_id)) return json(409, { message: "order with same id is already present", code: "order_already_exists" });
      const order: FakeOrder = {
        order_id: body.order_id, order_amount: body.order_amount, order_currency: body.order_currency,
        order_status: "ACTIVE", payment_session_id: `session_${body.order_id}`, customer_details: body.customer_details,
        payments: [], refunds: [],
      };
      orders.set(order.order_id, order);
      return json(200, { ...order, payments: undefined, refunds: undefined });
    }

    const orderMatch = /^\/orders\/([^/]+)(\/payments|\/refunds(?:\/([^/]+))?)?$/.exec(path);
    if (!orderMatch) return json(404, { message: "not found" });
    const order = orders.get(decodeURIComponent(orderMatch[1]!));
    if (!order) return json(404, { message: "order not found", code: "order_not_found" });
    const [, , sub, refundId] = orderMatch;

    if (method === "GET" && !sub) {
      return json(200, { order_id: order.order_id, order_amount: order.order_amount, order_currency: order.order_currency, order_status: order.order_status, payment_session_id: order.payment_session_id });
    }
    if (method === "GET" && sub === "/payments") return json(200, order.payments);
    if (method === "POST" && sub === "/refunds") {
      const body = JSON.parse(String(init.body));
      if (order.refunds.some((r) => r.refund_id === body.refund_id)) return json(409, { message: "refund_id already exists", code: "refund_already_exists" });
      const paid = order.payments.filter((p) => p.payment_status === "SUCCESS").reduce((sum, p) => sum + p.payment_amount, 0);
      const refunded = order.refunds.filter((r) => r.refund_status !== "CANCELLED").reduce((sum, r) => sum + r.refund_amount, 0);
      if (body.refund_amount > paid - refunded) return json(400, { message: "refund amount greater than refundable amount", code: "refund_amount_invalid" });
      const refund = { refund_id: body.refund_id, refund_amount: body.refund_amount, refund_status: "PENDING" as const };
      order.refunds.push(refund);
      return json(200, { ...refund, order_id: order.order_id, cf_refund_id: `cf_${body.refund_id}` });
    }
    if (method === "GET" && sub?.startsWith("/refunds") && refundId) {
      const refund = order.refunds.find((r) => r.refund_id === decodeURIComponent(refundId));
      return refund ? json(200, { ...refund, order_id: order.order_id }) : json(404, { message: "refund not found" });
    }
    return json(404, { message: "not found" });
  }

  /** Simulate a customer payment attempt on the hosted checkout. */
  function pay(orderId: string, status: PaymentStatus = "SUCCESS", group = "upi", amount?: number) {
    const order = orders.get(orderId);
    if (!order) throw new Error(`no such order ${orderId}`);
    const payment = { cf_payment_id: nextPaymentId++, payment_status: status, payment_amount: amount ?? order.order_amount, payment_currency: order.order_currency, payment_group: group };
    order.payments.push(payment);
    if (status === "SUCCESS") order.order_status = "PAID";
    return payment;
  }

  function expire(orderId: string) {
    const order = orders.get(orderId);
    if (order && order.order_status === "ACTIVE") order.order_status = "EXPIRED";
  }

  function settleRefund(orderId: string, refundId: string, status: "SUCCESS" | "CANCELLED" = "SUCCESS") {
    const refund = orders.get(orderId)?.refunds.find((r) => r.refund_id === refundId);
    if (refund) refund.refund_status = status;
  }

  /** A webhook request signed the way Cashfree signs (2023-08-01). */
  function webhookRequest(body: unknown, { secret = TEST_SECRET, timestamp = String(Date.now()) } = {}) {
    const raw = typeof body === "string" ? body : JSON.stringify(body);
    const signature = createHmac("sha256", secret).update(timestamp + raw).digest("base64");
    return new Request("https://example.test/api/webhooks/cashfree", {
      method: "POST", body: raw, headers: { "x-webhook-signature": signature, "x-webhook-timestamp": timestamp },
    });
  }

  function successWebhook(orderId: string, payment: { cf_payment_id: number; payment_amount: number; payment_currency: string; payment_status: string }) {
    return {
      type: "PAYMENT_SUCCESS_WEBHOOK", event_time: new Date().toISOString(),
      data: { order: { order_id: orderId, order_amount: payment.payment_amount, order_currency: payment.payment_currency }, payment },
    };
  }

  return { orders, calls, fetch: fetchStub, pay, expire, settleRefund, webhookRequest, successWebhook };
}

export type FakeCashfree = ReturnType<typeof createFakeCashfree>;

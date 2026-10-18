import { randomBytes } from "node:crypto";
import { db } from "@repo/database";
import { reportPaymentIncident } from "./payment-incidents";
import { sourcesOf, transitionOrder, type PaymentOrderStatus } from "./payment-order-status";
import { CashfreeError, cashfreeMode, createCashfreeOrder, fetchCashfreeOrder, fetchSuccessfulPayment, type GatewayPayment } from "./cashfree";

const RECORDING_PRICE_INR = 299;

export class RecordingPaymentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export type RecordingPayment = GatewayPayment;

function receiptPrefix(recordingId: string) {
  return `rec_${Buffer.from(recordingId.replaceAll("-", ""), "hex").toString("base64url")}_`;
}

/** The recording a "rec_" receipt (= order id) pays for, or null. */
export function recordingIdFromReceipt(receipt: string | null) {
  const encoded = /^rec_([A-Za-z0-9_-]{22})_[a-f0-9]{8}$/.exec(receipt ?? "")?.[1];
  if (!encoded) return null;
  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.length !== 16) return null;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export async function createRecordingPaymentOrder(userId: string, recordingId: unknown) {
  if (typeof recordingId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(recordingId)) {
    throw new RecordingPaymentError("Invalid recording", 400);
  }
  const session = await db.classSession.findFirst({ where: { id: recordingId, booking: { studentId: userId }, recordingUrl: { not: null } } });
  if (!session) throw new RecordingPaymentError("Recording not found", 404);
  if (session.isRecordingPaid) throw new RecordingPaymentError("Recording is already unlocked", 409);

  // A second tab or a retry must not open a second chargeable order: hand
  // back the open one while Cashfree still accepts payment for it.
  const open = await db.paymentOrder.findFirst({
    where: { userId, status: { in: sourcesOf("EXPIRED") }, receipt: { startsWith: receiptPrefix(recordingId) } },
    orderBy: { createdAt: "desc" },
  });
  if (open) {
    const existing = await withProviderErrors(() => fetchCashfreeOrder(open.orderId));
    if (existing.status === "ACTIVE" && existing.paymentSessionId) {
      return { orderId: open.orderId, paymentSessionId: existing.paymentSessionId, mode: cashfreeMode(), amount: open.amount, currency: "INR" };
    }
    if (existing.status === "PAID") {
      const payment = await withProviderErrors(() => fetchSuccessfulPayment(open.orderId));
      if (payment) await settleRecordingPayment(payment, userId);
      throw new RecordingPaymentError("Recording is already unlocked", 409);
    }
    await transitionOrder(db, { id: open.id }, "EXPIRED");
  }

  const receipt = `${receiptPrefix(recordingId)}${randomBytes(4).toString("hex")}`;
  // The receipt doubles as the Cashfree order id, so webhooks can be routed by prefix.
  const order = await withProviderErrors(() => createCashfreeOrder({ orderId: receipt, amountInr: RECORDING_PRICE_INR, customerId: userId }));
  await db.paymentOrder.create({ data: { userId, orderId: order.orderId, amount: RECORDING_PRICE_INR, currency: "INR", receipt, status: "CREATED" } });
  return { orderId: order.orderId, paymentSessionId: order.paymentSessionId, mode: order.mode, amount: RECORDING_PRICE_INR, currency: "INR" };
}

/** A signed webhook and a verified checkout share this transaction. */
export async function settleRecordingPayment(payment: RecordingPayment, userId?: string) {
  if (!payment || typeof payment.id !== "string" || !payment.id || typeof payment.order_id !== "string"
      || !payment.order_id || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    throw new RecordingPaymentError("Invalid payment details", 400);
  }
  return db.$transaction(async (tx) => {
    const order = await tx.paymentOrder.findUnique({ where: { orderId: payment.order_id } });
    if (!order || (userId && userId !== order.userId)) throw new RecordingPaymentError("Order not found", 404);
    const sessionId = recordingIdFromReceipt(order.receipt);
    if (!sessionId) throw new RecordingPaymentError("Invalid recording order", 400);
    if (payment.status !== "SUCCESS") throw new RecordingPaymentError("Payment is awaiting confirmation", 409);
    if (payment.amount !== order.amount * 100 || payment.currency !== order.currency) throw new RecordingPaymentError("Payment does not match order", 400);
    const session = await tx.classSession.findFirst({ where: { id: sessionId, booking: { studentId: order.userId } } });
    if (!session) throw new RecordingPaymentError("Recording not found", 404);
    if (order.status === "PAID" || order.status === "DUPLICATE") {
      if (order.paymentId !== payment.id) throw new RecordingPaymentError("Order already paid", 409);
      return;
    }
    if (!sourcesOf("PAID").includes(order.status as PaymentOrderStatus)) {
      throw new RecordingPaymentError(`Order is ${order.status.toLowerCase().replace("_", " ")} and cannot be fulfilled.`, 409);
    }
    const claimed = await transitionOrder(tx, { id: order.id }, "PAID", { paymentId: payment.id });
    if (!claimed) return;
    // Conditional, so two paid orders for one recording cannot both unlock it:
    // the loser keeps the money on record as DUPLICATE, owed back to the student.
    const unlocked = await tx.classSession.updateMany({ where: { id: session.id, isRecordingPaid: false }, data: { isRecordingPaid: true } });
    if (!unlocked.count) {
      await transitionOrder(tx, { id: order.id }, "DUPLICATE", {}, ["PAID"]);
      await reportPaymentIncident({
        kind: "duplicate_payment", orderId: order.orderId, paymentId: payment.id, amountPaise: payment.amount,
        reason: "Paid for a recording that was already unlocked by another order; refund it from the admin panel.",
      });
      return;
    }
    await tx.payment.create({ data: { userId: order.userId, bookingId: session.bookingId, type: "RECORDING_FEE", amount: payment.amount, status: "SUCCESS", gatewayOrderId: order.orderId, gatewayPaymentId: payment.id } });
  });
}

export async function verifyRecordingPayment(userId: string, body: unknown) {
  if (!body || typeof body !== "object") throw new RecordingPaymentError("Invalid payment details", 400);
  const orderId = (body as Record<string, unknown>).orderId;
  if (typeof orderId !== "string" || !orderId) throw new RecordingPaymentError("Invalid payment details", 400);
  const order = await db.paymentOrder.findUnique({ where: { orderId } });
  if (!order || order.userId !== userId || !recordingIdFromReceipt(order.receipt)) throw new RecordingPaymentError("Order not found", 404);
  const payment = await withProviderErrors(() => fetchSuccessfulPayment(order.orderId));
  if (!payment) throw new RecordingPaymentError("Payment is awaiting confirmation", 409);
  await settleRecordingPayment(payment, userId);
}

async function withProviderErrors<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof CashfreeError) throw new RecordingPaymentError(error.message, error.status);
    throw error;
  }
}

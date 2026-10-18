import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "@repo/database";

const RECORDING_PRICE_INR = 299;

export class RecordingPaymentError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export interface RecordingPayment {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
}

function providerOrder(value: unknown): value is { id: string; amount: number; currency: string } {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.id === "string" && typeof data.amount === "number" && typeof data.currency === "string";
}

function providerPayment(value: unknown): value is RecordingPayment {
  if (!providerOrder(value)) return false;
  const data = value as unknown as Record<string, unknown>;
  return typeof data.order_id === "string" && typeof data.status === "string";
}

function providerAuthorization() {
  const key = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key || !secret) throw new RecordingPaymentError("Payments are unavailable", 503);
  return { key, secret, authorization: "Basic " + Buffer.from(`${key}:${secret}`).toString("base64") };
}

function recordingIdFromReceipt(receipt: string | null) {
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
  const { key, authorization } = providerAuthorization();
  const receipt = `rec_${Buffer.from(recordingId.replaceAll("-", ""), "hex").toString("base64url")}_${randomBytes(4).toString("hex")}`;
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST", headers: { Authorization: authorization, "Content-Type": "application/json" },
    body: JSON.stringify({ amount: RECORDING_PRICE_INR * 100, currency: "INR", receipt }),
  });
  if (!response.ok) throw new RecordingPaymentError("Payment provider error", 502);
  const order = await response.json();
  if (!providerOrder(order) || order.amount !== RECORDING_PRICE_INR * 100 || order.currency !== "INR") {
    throw new RecordingPaymentError("Invalid payment provider response", 502);
  }
  await db.razorpayOrder.create({ data: { userId, orderId: order.id, amount: RECORDING_PRICE_INR, currency: "INR", receipt, status: "CREATED" } });
  return { orderId: order.id, amount: order.amount, currency: "INR", keyId: key };
}

/** A signed captured webhook and a verified checkout share this transaction. */
export async function settleRecordingPayment(payment: RecordingPayment, userId?: string, signature?: string) {
  if (!payment || typeof payment.id !== "string" || !payment.id || typeof payment.order_id !== "string"
      || !payment.order_id || !Number.isSafeInteger(payment.amount) || payment.amount <= 0) {
    throw new RecordingPaymentError("Invalid payment details", 400);
  }
  return db.$transaction(async (tx) => {
    const order = await tx.razorpayOrder.findUnique({ where: { orderId: payment.order_id } });
    if (!order || (userId && userId !== order.userId)) throw new RecordingPaymentError("Order not found", 404);
    const sessionId = recordingIdFromReceipt(order.receipt);
    if (!sessionId) throw new RecordingPaymentError("Invalid recording order", 400);
    if (payment.status !== "captured") throw new RecordingPaymentError("Payment is awaiting capture", 409);
    if (payment.amount !== order.amount * 100 || payment.currency !== order.currency) throw new RecordingPaymentError("Payment does not match order", 400);
    const session = await tx.classSession.findFirst({ where: { id: sessionId, booking: { studentId: order.userId } } });
    if (!session) throw new RecordingPaymentError("Recording not found", 404);
    if (order.status === "PAID") {
      if (order.paymentId !== payment.id) throw new RecordingPaymentError("Order already paid", 409);
      return;
    }
    const claimed = await tx.razorpayOrder.updateMany({ where: { id: order.id, status: { not: "PAID" } }, data: { status: "PAID", paymentId: payment.id, ...(signature ? { signature } : {}) } });
    if (!claimed.count) return;
    await tx.classSession.update({ where: { id: session.id }, data: { isRecordingPaid: true } });
    await tx.payment.create({ data: { userId: order.userId, bookingId: session.bookingId, type: "RECORDING_FEE", amount: payment.amount, status: "SUCCESS", razorpayOrderId: order.orderId, razorpayPaymentId: payment.id } });
  });
}

export async function verifyRecordingPayment(userId: string, body: unknown) {
  if (!body || typeof body !== "object") throw new RecordingPaymentError("Invalid payment details", 400);
  const data = body as Record<string, unknown>;
  const orderId = data.razorpay_order_id;
  const paymentId = data.razorpay_payment_id;
  const signature = data.razorpay_signature;
  if (typeof orderId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" || !/^[a-f0-9]{64}$/i.test(signature)) throw new RecordingPaymentError("Invalid payment details", 400);
  const order = await db.razorpayOrder.findUnique({ where: { orderId } });
  if (!order || order.userId !== userId || !recordingIdFromReceipt(order.receipt)) throw new RecordingPaymentError("Order not found", 404);
  const { secret, authorization } = providerAuthorization();
  const expected = createHmac("sha256", secret).update(`${order.orderId}|${paymentId}`).digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) throw new RecordingPaymentError("Invalid signature", 400);
  const paymentRequest = { headers: { Authorization: authorization }, cache: "no-store" as const };
  const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}`, paymentRequest);
  if (!response.ok) throw new RecordingPaymentError("Payment confirmation is unavailable", 502);
  const payment = await response.json();
  if (!providerPayment(payment) || payment.id !== paymentId || payment.order_id !== order.orderId) throw new RecordingPaymentError("Payment does not match order", 400);
  await settleRecordingPayment(payment, userId, signature);
}

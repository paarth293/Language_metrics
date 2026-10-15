import crypto from 'crypto';

export function verifyRazorpaySignature(
  orderId: string,
  paymentId: string,
  signature: string
): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_KEY_SECRET is not configured');
  }

  const generatedSignature = crypto
    .createHmac('sha256', secret)
    .update(orderId + '|' + paymentId)
    .digest('hex');

  return signaturesMatch(generatedSignature, signature);
}

export function verifyWebhookSignature(payload: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return signaturesMatch(expectedSignature, signature);
}

function signaturesMatch(expected: string, received: string): boolean {
  if (typeof received !== 'string' || !/^[a-f0-9]{64}$/i.test(received)) return false;
  return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(received, 'hex'));
}

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { verifyRazorpaySignature } from '@/lib/razorpay-verify';
import { creditCoins } from '@/lib/coin-service';
import { checkAndSetIdempotency } from '@/lib/idempotency';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'STUDENT');
    if (auth.error) {
      return auth.error;
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, coinsToCredit } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing payment details' }, { status: 400 });
    }

    // Verify signature
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    // Check idempotency for this payment verification
    const isNew = await checkAndSetIdempotency(`verify_${razorpay_payment_id}`);
    if (!isNew) {
      return NextResponse.json({ success: true, message: 'Payment already verified' });
    }

    // Update DB
    const order = await db.razorpayOrder.findUnique({
      where: { orderId: razorpay_order_id }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.status !== 'PAID') {
      await db.razorpayOrder.update({
        where: { id: order.id },
        data: {
          status: 'PAID',
          paymentId: razorpay_payment_id,
          signature: razorpay_signature
        }
      });

      // Credit coins
      const coins = coinsToCredit || order.amount; // Fallback to 1:1 if not provided
      await creditCoins(auth.user.sub, coins, 'Coin purchase');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Verify payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

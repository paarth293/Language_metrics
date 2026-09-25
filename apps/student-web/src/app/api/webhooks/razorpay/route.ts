import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/razorpay-verify';
import { checkAndSetIdempotency } from '@/lib/idempotency';
import { creditCoins } from '@/lib/coin-service';

export async function POST(req: Request) {
  try {
    const signature = req.headers.get('x-razorpay-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    const payloadString = await req.text();
    
    try {
      if (!verifyWebhookSignature(payloadString, signature)) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
      }
    } catch (err) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 500 });
    }

    const payload = JSON.parse(payloadString);
    const eventId = payload.headers && payload.headers['x-razorpay-event-id'] ? payload.headers['x-razorpay-event-id'] : payload.event_id || payload.payment?.entity?.id || String(Date.now());
    
    // Check idempotency
    const isNew = await checkAndSetIdempotency(`webhook_rp_${eventId}`);
    if (!isNew) {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    if (payload.event === 'payment.captured' || payload.event === 'order.paid') {
      const paymentEntity = payload.payload.payment.entity;
      const orderId = paymentEntity.order_id;
      
      const order = await db.razorpayOrder.findUnique({
        where: { orderId }
      });

      if (order && order.status !== 'PAID') {
        // Update order status
        await db.razorpayOrder.update({
          where: { id: order.id },
          data: { status: 'PAID', paymentId: paymentEntity.id }
        });

        // Add coins (amount in INR = 1:1 roughly for now, or fetch from package)
        // Let's assume the amount saved in order is the INR amount, we can determine coins from that
        // Assuming package gives coins = amount * ratio, here we'll just credit order amount * 10 
        // Real implementation would look up the package
        await creditCoins(order.userId, order.amount, 'Coin purchase via Razorpay');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

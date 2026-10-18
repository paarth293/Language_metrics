import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';
import { CashfreeError, createCashfreeOrder } from '@repo/live-classes';
import { COIN_PACKAGES } from '@/types/coins';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'STUDENT');
    if (auth.error) {
      return auth.error;
    }

    const { amount, currency = 'INR', packageId } = await req.json();

    const pack = packageId
      ? COIN_PACKAGES.find((entry) => entry.id === packageId)
      : COIN_PACKAGES.find((entry) => entry.priceInr === amount);
    if (!pack || currency !== 'INR' || (amount !== undefined && amount !== pack.priceInr)) {
      return NextResponse.json({ error: 'Invalid coin package or amount' }, { status: 400 });
    }
    // The receipt snapshots the coin quantity and doubles as the Cashfree order id.
    const receipt = `coins_${pack.coins}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;

    const order = await createCashfreeOrder({ orderId: receipt, amountInr: pack.priceInr, customerId: auth.user.sub });

    // Save to our DB
    await db.paymentOrder.create({
      data: {
        orderId: order.orderId,
        amount: pack.priceInr,
        currency,
        status: 'CREATED',
        receipt,
        userId: auth.user.sub
      }
    });

    return NextResponse.json({ orderId: order.orderId, paymentSessionId: order.paymentSessionId, mode: order.mode });
  } catch (error) {
    if (error instanceof CashfreeError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

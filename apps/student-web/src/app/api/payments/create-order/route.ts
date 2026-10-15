import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { randomUUID } from 'node:crypto';
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
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      return NextResponse.json({ error: 'Payments are unavailable' }, { status: 503 });
    }
    const receipt = `coins_${pack.coins}_${randomUUID().replaceAll('-', '').slice(0, 24)}`;

    const authHeader = 'Basic ' + Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');

    // Call Razorpay API to create order
    const rpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: pack.priceInr * 100, // Razorpay works in paise
        currency,
        receipt
      })
    });

    if (!rpResponse.ok) {
      const rpError = await rpResponse.json();
      console.error('Razorpay Error:', rpError);
      return NextResponse.json({ error: 'Payment provider error' }, { status: 502 });
    }

    const rpOrder = await rpResponse.json();
    if (typeof rpOrder.id !== 'string' || rpOrder.amount !== pack.priceInr * 100 || rpOrder.currency !== currency) {
      return NextResponse.json({ error: 'Payment provider returned an invalid order' }, { status: 502 });
    }

    // Save to our DB
    await db.razorpayOrder.create({
      data: {
        orderId: rpOrder.id,
        amount: pack.priceInr,
        currency,
        status: 'CREATED',
        receipt,
        userId: auth.user.sub
      }
    });

    return NextResponse.json(rpOrder);
  } catch (error) {
    if (error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

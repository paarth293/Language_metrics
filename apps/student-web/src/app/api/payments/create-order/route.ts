import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const auth = await requireAuth(req, 'STUDENT');
    if (auth.error) {
      return auth.error;
    }

    const { amount, currency = 'INR', packageId } = await req.json();

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const authHeader = 'Basic ' + Buffer.from(process.env.RAZORPAY_KEY_ID + ':' + process.env.RAZORPAY_KEY_SECRET).toString('base64');
    
    // Call Razorpay API to create order
    const rpResponse = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        amount: amount * 100, // Razorpay works in paise
        currency,
        receipt: `receipt_${Date.now()}`
      })
    });

    if (!rpResponse.ok) {
      const rpError = await rpResponse.json();
      console.error('Razorpay Error:', rpError);
      return NextResponse.json({ error: 'Payment provider error' }, { status: 502 });
    }

    const rpOrder = await rpResponse.json();

    // Save to our DB
    await db.razorpayOrder.create({
      data: {
        orderId: rpOrder.id,
        amount,
        currency,
        status: rpOrder.status,
        receipt: rpOrder.receipt,
        userId: auth.user.sub
      }
    });

    return NextResponse.json(rpOrder);
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getCoinBalance } from '@/lib/coin-service';

export async function GET(req: Request) {
  try {
    const auth = await requireAuth(req, 'STUDENT');
    if (auth.error) {
      return auth.error;
    }

    const balance = await getCoinBalance(auth.user.sub);
    
    return NextResponse.json({ balance });
  } catch (error) {
    console.error('Coin balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

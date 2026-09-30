import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCoinBalance } from "@repo/database";

export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // `amount` is already signed (credits positive, debits negative), so it is
    // shown as-is; the balance comes from CoinAccount.
    const [balance, transactions] = await Promise.all([
      getCoinBalance(userId),
      db.coinTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      balance: balance.balance,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        description: t.description,
        createdAt: t.createdAt,
      })),
    }, { status: 200 });

  } catch (err) {
    console.error("GET /api/teachers/wallet error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

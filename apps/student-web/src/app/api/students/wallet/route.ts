import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getCoinBalance } from "@repo/database";

/**
 * GET /api/students/wallet
 * Returns the student's coin balance and transaction history.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // `amount` is the signed change to spendable balance for every row type
    // (see packages/database/src/coin-ledger.ts), so it is displayed as-is.
    // The balance is read from CoinAccount rather than re-derived here.
    const [balance, transactions] = await Promise.all([
      getCoinBalance(userId),
      db.coinTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);

    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type.toLowerCase(),
      amount: tx.amount,
      description: tx.description || "",
      createdAt: tx.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        balance: balance.balance,
        heldBalance: balance.heldBalance,
        transactions: formattedTransactions,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/students/wallet error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

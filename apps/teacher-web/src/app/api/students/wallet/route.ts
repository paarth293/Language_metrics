import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/wallet
 * Returns the student's coin balance and transaction history.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // Get all transactions
    const transactions = await db.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Calculate balance
    const balance = transactions.reduce((acc, tx) => acc + tx.amount, 0);

    // Format transactions
    const formattedTransactions = transactions.map((tx) => ({
      id: tx.id,
      type: tx.type.toLowerCase(),
      amount: tx.amount,
      description: tx.description || "",
      createdAt: tx.createdAt.toISOString(),
    }));

    return NextResponse.json(
      {
        balance,
        transactions: formattedTransactions,
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/students/wallet error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

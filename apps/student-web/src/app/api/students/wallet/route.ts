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

    // Fetch the FULL ledger to compute balance — CoinTransaction.amount is
    // stored unsigned (always positive); the sign is derived from `type`.
    // This must match the convention used by /api/teachers/wallet and
    // teacher-service.ts's earnings summary, or the balance shown here will
    // disagree with the rest of the app. Do NOT cap this query with `take`:
    // a balance computed from only the most recent N rows is wrong for any
    // user with a longer history.
    const allTransactions = await db.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    const signedAmount = (tx: (typeof allTransactions)[number]) =>
      tx.type === "SPEND" ? -tx.amount : tx.amount;

    const balance = allTransactions.reduce((acc, tx) => acc + signedAmount(tx), 0);

    // Only the most recent 50 are returned for display.
    const formattedTransactions = allTransactions.slice(0, 50).map((tx) => ({
      id: tx.id,
      type: tx.type.toLowerCase(),
      amount: signedAmount(tx),
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

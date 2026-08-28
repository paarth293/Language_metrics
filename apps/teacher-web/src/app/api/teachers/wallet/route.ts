import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // 1. Get current balance (sum of all transactions)
    const transactions = await db.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    let balance = 0;
    for (const tx of transactions) {
      // Assuming positive amounts are additions, negative amounts are deductions
      // Wait, is amount signed? Or does 'type' determine sign?
      // Let's assume PURCHASE, BONUS add to balance, SPEND, REFUND subtract?
      // Actually, standard is SPEND is negative amount or type SPEND implies subtraction.
      // Let's just sum it up if amount is signed, otherwise we conditionally add/sub.
      // For now, let's assume `amount` is signed (e.g. -50 for spend, +100 for purchase)
      // If it's unsigned, we do:
      if (tx.type === "SPEND") balance -= tx.amount;
      else balance += tx.amount;
    }

    return NextResponse.json({
      balance,
      transactions: transactions.map(t => ({
        id: t.id,
        type: t.type,
        amount: t.type === "SPEND" ? -t.amount : t.amount,
        description: t.description,
        createdAt: t.createdAt,
      })),
    }, { status: 200 });

  } catch (err) {
    console.error("GET /api/teachers/wallet error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

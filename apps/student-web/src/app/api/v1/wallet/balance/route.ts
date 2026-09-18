import { NextRequest, NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth-mobile";
import { getCoinBalance } from "@/lib/coin-service";
import { CoinBalanceResponseSchema } from "@repo/api-contracts";

/**
 * GET /api/v1/wallet/balance
 *
 * Mobile endpoint to fetch current student coin balance.
 * Requires Bearer token in Authorization header.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request, ["STUDENT"]);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const balance = await getCoinBalance(auth.user.id);
    const payload = CoinBalanceResponseSchema.parse({
      balance,
      currency: "INR",
      coinUnitValueInr: 1,
    });

    return NextResponse.json(payload, { status: 200 });
  } catch (error) {
    console.error("[Mobile API] Balance fetch error:", error);
    return NextResponse.json({ message: "Failed to retrieve wallet balance." }, { status: 500 });
  }
}

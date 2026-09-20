/**
 * Coin service — now a thin adapter over the ledger in @repo/database.
 *
 * ── The bug this file had ──────────────────────────────────────────────────
 *
 * The previous `getCoinBalance()` computed:
 *
 *     if (type === 'PURCHASE' | 'BONUS' | 'REFUND') acc + tx.amount
 *     else if (type === 'SPEND')                    acc - tx.amount
 *
 * That assumes SPEND rows carry a positive magnitude. But both booking routes
 * wrote SPEND rows with an already-negative amount:
 *
 *     { type: "SPEND", amount: -rate.amount }
 *
 * `acc - (-300)` is `acc + 300`. Booking a class INCREASED the balance this
 * function reported, by exactly twice the class price relative to the truth.
 * A student could book indefinitely, and the wallet page and the booking
 * routes (which summed `t.amount` raw, and so were correct) disagreed with
 * each other the whole time.
 *
 * The fix is not a better reducer. It is to stop deriving balances from a
 * table whose sign convention was never enforced: `amount` is now always the
 * signed delta, the balance lives in CoinAccount, and `backfillCoinAccounts()`
 * normalises the historical rows by type.
 *
 * Run `npm run db:backfill-coins` once after deploying.
 */

import {
  credit,
  debit,
  getCoinBalance as ledgerBalance,
  type CoinBalance,
} from "@repo/database";

/**
 * Spendable coin balance.
 *
 * NOTE: this no longer includes coins held against upcoming classes. Use
 * `getFullCoinBalance()` when you need to show the student their total.
 */
export async function getCoinBalance(userId: string): Promise<number> {
  return (await ledgerBalance(userId)).balance;
}

/** Spendable, held and lifetime totals. */
export async function getFullCoinBalance(userId: string): Promise<CoinBalance> {
  return ledgerBalance(userId);
}

export async function creditCoins(
  userId: string,
  amount: number,
  description?: string,
  idempotencyKey?: string
): Promise<void> {
  await credit({ userId, amount, type: "PURCHASE", description, idempotencyKey });
}

/**
 * Spend coins immediately.
 *
 * Returns false when the balance is insufficient, matching the old signature.
 * Unlike the old version there is no window between the check and the write:
 * the balance condition is part of the UPDATE.
 *
 * For classes, prefer `holdCoinsForSession()` from @repo/live-classes — a
 * class should not be charged before it has been taught.
 */
export async function debitCoins(
  userId: string,
  amount: number,
  description?: string,
  idempotencyKey?: string
): Promise<boolean> {
  try {
    await debit({ userId, amount, description, idempotencyKey });
    return true;
  } catch (err) {
    if (err instanceof Error && err.name === "InsufficientCoinsError") return false;
    throw err;
  }
}

/**
 * Coin ledger — atomic, O(1), idempotent.
 *
 * ── Why this replaces lib/coin-service.ts ──────────────────────────────────
 *
 * The previous implementation had three defects that per-minute billing would
 * have turned from latent into expensive:
 *
 *   1. Sign convention was contradictory. `coin-service.getCoinBalance()`
 *      treated SPEND as a positive magnitude and SUBTRACTED it, while
 *      `/api/students/teacher/[id]/book` and `/api/v1/bookings` wrote SPEND
 *      rows with an ALREADY-NEGATIVE amount. Subtracting a negative adds:
 *      booking a class INCREASED the balance that coin-service reported.
 *      Fixed here by making `amount` the signed delta, always, and by
 *      normalising legacy rows in `backfillCoinAccounts()`.
 *
 *   2. Read-then-write race. `debitCoins()` read the balance, compared it,
 *      then wrote — two overlapping requests both passed the check. The
 *      booking routes worked around this with Serializable isolation, which
 *      is correct but costs a retry storm under load. Here a debit is one
 *      conditional UPDATE whose WHERE clause *is* the balance check, so
 *      Postgres row-locking does the work and there is nothing to retry.
 *
 *   3. O(n) balance reads. Every balance check loaded the user's entire
 *      transaction history. Per-minute billing writes several rows per class,
 *      so that history grows without bound and every read gets slower forever.
 *      Balances now live in CoinAccount and are read by primary key.
 *
 * ── Invariants ─────────────────────────────────────────────────────────────
 *
 *   * `CoinTransaction.amount` is the SIGNED change to spendable balance.
 *     Credits positive, debits negative. No exceptions.
 *   * `balance` is spendable. `heldBalance` is reserved against a booked
 *     class. A coin is in exactly one of them, never both, never neither.
 *   * Every mutation is idempotent when given an `idempotencyKey`.
 */

import { Prisma, type PrismaClient } from "@prisma/client";
import { db } from "./index";

export type Tx = Prisma.TransactionClient | PrismaClient;

export class InsufficientCoinsError extends Error {
  readonly code = "INSUFFICIENT_COINS";
  constructor(
    readonly required: number,
    readonly available: number
  ) {
    super(`Insufficient coins. Need ${required}, have ${available}.`);
    this.name = "InsufficientCoinsError";
  }
}

export class InsufficientHoldError extends Error {
  readonly code = "INSUFFICIENT_HOLD";
  constructor(
    readonly required: number,
    readonly held: number
  ) {
    super(`Hold too small. Need ${required} held, have ${held}.`);
    this.name = "InsufficientHoldError";
  }
}

export interface CoinBalance {
  balance: number;
  heldBalance: number;
  /** balance + heldBalance — what the user sees as "my coins". */
  totalBalance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
}

const ZERO: CoinBalance = {
  balance: 0,
  heldBalance: 0,
  totalBalance: 0,
  lifetimeEarned: 0,
  lifetimeSpent: 0,
};

/** Creates the account row if absent. Safe to call concurrently. */
export async function ensureCoinAccount(userId: string, client: Tx = db): Promise<void> {
  await client.$executeRaw`
    INSERT INTO "CoinAccount" ("userId", "balance", "heldBalance", "lifetimeEarned", "lifetimeSpent", "version", "createdAt", "updatedAt")
    VALUES (${userId}::uuid, 0, 0, 0, 0, 0, NOW(), NOW())
    ON CONFLICT ("userId") DO NOTHING
  `;
}

/** O(1) balance read. */
export async function getCoinBalance(userId: string, client: Tx = db): Promise<CoinBalance> {
  const account = await client.coinAccount.findUnique({ where: { userId } });
  if (!account) return { ...ZERO };
  return {
    balance: account.balance,
    heldBalance: account.heldBalance,
    totalBalance: account.balance + account.heldBalance,
    lifetimeEarned: account.lifetimeEarned,
    lifetimeSpent: account.lifetimeSpent,
  };
}

/** Spendable balance only. The number a purchase decision is made against. */
export async function getSpendableBalance(userId: string, client: Tx = db): Promise<number> {
  return (await getCoinBalance(userId, client)).balance;
}

export type LedgerEntryType =
  | "PURCHASE"
  | "BONUS"
  | "SPEND"
  | "REFUND"
  | "HOLD"
  | "HOLD_RELEASE"
  | "ADJUSTMENT";

interface EntryContext {
  description?: string;
  idempotencyKey?: string;
  classSessionId?: string;
  bookingId?: string;
}

/**
 * Returns true if this key has already been applied.
 *
 * Checked inside the caller's transaction so a concurrent duplicate loses at
 * the unique index rather than here — this is a fast path, not the guarantee.
 */
async function alreadyApplied(key: string | undefined, client: Tx): Promise<boolean> {
  if (!key) return false;
  const existing = await client.coinTransaction.findUnique({
    where: { idempotencyKey: key },
    select: { id: true },
  });
  return existing !== null;
}

async function writeEntry(
  client: Tx,
  userId: string,
  type: LedgerEntryType,
  signedAmount: number,
  balanceAfter: number,
  ctx: EntryContext
): Promise<void> {
  await client.coinTransaction.create({
    data: {
      userId,
      type,
      amount: signedAmount,
      balanceAfter,
      description: ctx.description ?? null,
      idempotencyKey: ctx.idempotencyKey ?? null,
      classSessionId: ctx.classSessionId ?? null,
      bookingId: ctx.bookingId ?? null,
    },
  });
}

/** Add spendable coins. Used for top-ups, bonuses and manual credits. */
export async function credit(
  params: { userId: string; amount: number; type: "PURCHASE" | "BONUS" | "ADJUSTMENT" } & EntryContext,
  client: Tx = db
): Promise<CoinBalance> {
  const { userId, amount, type, ...ctx } = params;
  if (amount <= 0) throw new Error("credit() requires a positive amount.");
  if (await alreadyApplied(ctx.idempotencyKey, client)) return getCoinBalance(userId, client);

  await ensureCoinAccount(userId, client);
  const rows = await client.$queryRaw<Array<{ balance: number }>>`
    UPDATE "CoinAccount"
       SET "balance"        = "balance" + ${amount},
           "lifetimeEarned" = "lifetimeEarned" + ${amount},
           "version"        = "version" + 1,
           "updatedAt"      = NOW()
     WHERE "userId" = ${userId}::uuid
    RETURNING "balance"
  `;
  const balanceAfter = rows[0]?.balance ?? 0;
  await writeEntry(client, userId, type, amount, balanceAfter, ctx);
  return getCoinBalance(userId, client);
}

/**
 * Spend coins immediately.
 *
 * The balance check IS the WHERE clause. If the row does not match, nothing
 * was written and we report insufficient funds — there is no window between
 * the check and the write for a second request to slip through.
 */
export async function debit(
  params: { userId: string; amount: number } & EntryContext,
  client: Tx = db
): Promise<CoinBalance> {
  return debitAs("SPEND", params, client);
}

/**
 * Manual correction by an admin, in either direction.
 *
 * `delta` is signed: positive adds spendable coins, negative removes them.
 * A removal never dips into held coins and never takes spendable below zero —
 * it fails with InsufficientCoinsError instead. Unlike the other entry points
 * the description and idempotency key are mandatory, because every manual
 * movement of money must say why and must be safe to retry.
 */
export async function adjust(
  params: { userId: string; delta: number; description: string; idempotencyKey: string },
  client: Tx = db
): Promise<CoinBalance> {
  const { userId, delta, description, idempotencyKey } = params;
  if (!Number.isInteger(delta) || delta === 0) throw new Error("adjust() requires a non-zero integer delta.");
  if (!description.trim()) throw new Error("adjust() requires a description.");
  if (!idempotencyKey) throw new Error("adjust() requires an idempotency key.");

  const ctx = { userId, description, idempotencyKey };
  return delta > 0
    ? credit({ ...ctx, amount: delta, type: "ADJUSTMENT" }, client)
    : debitAs("ADJUSTMENT", { ...ctx, amount: -delta }, client);
}

async function debitAs(
  type: "SPEND" | "ADJUSTMENT",
  params: { userId: string; amount: number } & EntryContext,
  client: Tx
): Promise<CoinBalance> {
  const { userId, amount, ...ctx } = params;
  if (amount <= 0) throw new Error("debit() requires a positive amount.");
  if (await alreadyApplied(ctx.idempotencyKey, client)) return getCoinBalance(userId, client);

  await ensureCoinAccount(userId, client);
  const rows = await client.$queryRaw<Array<{ balance: number }>>`
    UPDATE "CoinAccount"
       SET "balance"       = "balance" - ${amount},
           "lifetimeSpent" = "lifetimeSpent" + ${amount},
           "version"       = "version" + 1,
           "updatedAt"     = NOW()
     WHERE "userId" = ${userId}::uuid
       AND "balance" >= ${amount}
    RETURNING "balance"
  `;
  if (rows.length === 0) {
    const current = await getCoinBalance(userId, client);
    throw new InsufficientCoinsError(amount, current.balance);
  }
  await writeEntry(client, userId, type, -amount, rows[0]!.balance, ctx);
  return getCoinBalance(userId, client);
}

/**
 * Reserve coins against a booked class.
 *
 * Moves coins from spendable to held. The student sees the same total; they
 * simply cannot spend the reserved portion twice. Nothing is charged yet —
 * the charge happens at settlement, against measured minutes.
 */
export async function hold(
  params: { userId: string; amount: number } & EntryContext,
  client: Tx = db
): Promise<CoinBalance> {
  const { userId, amount, ...ctx } = params;
  if (amount <= 0) throw new Error("hold() requires a positive amount.");
  if (await alreadyApplied(ctx.idempotencyKey, client)) return getCoinBalance(userId, client);

  await ensureCoinAccount(userId, client);
  const rows = await client.$queryRaw<Array<{ balance: number }>>`
    UPDATE "CoinAccount"
       SET "balance"     = "balance" - ${amount},
           "heldBalance" = "heldBalance" + ${amount},
           "version"     = "version" + 1,
           "updatedAt"   = NOW()
     WHERE "userId" = ${userId}::uuid
       AND "balance" >= ${amount}
    RETURNING "balance"
  `;
  if (rows.length === 0) {
    const current = await getCoinBalance(userId, client);
    throw new InsufficientCoinsError(amount, current.balance);
  }
  await writeEntry(client, userId, "HOLD", -amount, rows[0]!.balance, ctx);
  return getCoinBalance(userId, client);
}

/** Return a hold to spendable without charging. Used for cancellations. */
export async function releaseHold(
  params: { userId: string; amount: number } & EntryContext,
  client: Tx = db
): Promise<CoinBalance> {
  const { userId, amount, ...ctx } = params;
  if (amount <= 0) throw new Error("releaseHold() requires a positive amount.");
  if (await alreadyApplied(ctx.idempotencyKey, client)) return getCoinBalance(userId, client);

  const rows = await client.$queryRaw<Array<{ balance: number }>>`
    UPDATE "CoinAccount"
       SET "balance"     = "balance" + ${amount},
           "heldBalance" = "heldBalance" - ${amount},
           "version"     = "version" + 1,
           "updatedAt"   = NOW()
     WHERE "userId" = ${userId}::uuid
       AND "heldBalance" >= ${amount}
    RETURNING "balance"
  `;
  if (rows.length === 0) {
    const current = await getCoinBalance(userId, client);
    throw new InsufficientHoldError(amount, current.heldBalance);
  }
  await writeEntry(client, userId, "HOLD_RELEASE", amount, rows[0]!.balance, ctx);
  return getCoinBalance(userId, client);
}

export interface CaptureHoldParams extends EntryContext {
  userId: string;
  /** The full amount previously held for this class. */
  heldAmount: number;
  /** What the measured class actually cost. 0 <= chargeAmount <= heldAmount. */
  chargeAmount: number;
}

/**
 * Settle a hold: charge part of it, return the rest.
 *
 * Written as ONE statement so a crash cannot leave a class half-settled with
 * coins stranded in `heldBalance` — the state every metered-billing system
 * eventually produces if capture and refund are two separate writes.
 */
export async function captureHold(
  params: CaptureHoldParams,
  client: Tx = db
): Promise<{ balance: CoinBalance; charged: number; refunded: number }> {
  const { userId, heldAmount, chargeAmount, ...ctx } = params;
  if (chargeAmount < 0 || heldAmount < 0) throw new Error("captureHold() amounts must be >= 0.");
  if (chargeAmount > heldAmount) {
    throw new Error("captureHold() cannot charge more than was held; use debit() for overage.");
  }

  // The release row is always written when anything was held, so it is the
  // reliable marker for "this settlement already happened".
  const releaseKey = ctx.idempotencyKey ? `${ctx.idempotencyKey}:release` : undefined;
  if (await alreadyApplied(releaseKey, client)) {
    return { balance: await getCoinBalance(userId, client), charged: 0, refunded: 0 };
  }

  const refund = heldAmount - chargeAmount;

  const rows = await client.$queryRaw<Array<{ balance: number }>>`
    UPDATE "CoinAccount"
       SET "heldBalance"   = "heldBalance" - ${heldAmount},
           "balance"       = "balance" + ${refund},
           "lifetimeSpent" = "lifetimeSpent" + ${chargeAmount},
           "version"       = "version" + 1,
           "updatedAt"     = NOW()
     WHERE "userId" = ${userId}::uuid
       AND "heldBalance" >= ${heldAmount}
    RETURNING "balance"
  `;
  if (rows.length === 0) {
    const current = await getCoinBalance(userId, client);
    throw new InsufficientHoldError(heldAmount, current.heldBalance);
  }
  const balanceAfter = rows[0]!.balance;

  // Double entry, and the ONLY arrangement that keeps the ledger summing to
  // the balance.
  //
  // The HOLD row already removed the full amount from spendable. Settlement
  // must therefore put ALL of it back (HOLD_RELEASE +heldAmount) and then
  // take the charge (SPEND -chargeAmount). Net: +refund, which is exactly
  // what moved. Writing only `SPEND -chargeAmount` here — the obvious thing —
  // charges the student twice, once at hold and once at capture.
  if (heldAmount > 0) {
    await writeEntry(client, userId, "HOLD_RELEASE", heldAmount, balanceAfter, {
      ...ctx,
      description: ctx.description ? `${ctx.description} (hold released)` : "Class hold released",
      idempotencyKey: releaseKey,
    });
  }
  if (chargeAmount > 0) {
    await writeEntry(client, userId, "SPEND", -chargeAmount, balanceAfter, {
      ...ctx,
      description: ctx.description ?? "Class charged",
      idempotencyKey: ctx.idempotencyKey ? `${ctx.idempotencyKey}:spend` : undefined,
    });
  }

  return {
    balance: await getCoinBalance(userId, client),
    charged: chargeAmount,
    refunded: refund,
  };
}

// ── Migration ───────────────────────────────────────────────────────────────

/**
 * Normalise legacy CoinTransaction rows and materialise CoinAccount.
 *
 * Legacy rows are inconsistent: some SPEND rows carry a negative amount
 * (written by the booking routes) and some a positive magnitude (written by
 * `coin-service.debitCoins`). Normalising by TYPE rather than by sign gets
 * both right, because the type was always correct even when the sign was not.
 *
 * Idempotent: rerunning it recomputes the same balances.
 */
export async function backfillCoinAccounts(): Promise<{ accounts: number; rowsNormalised: number }> {
  const normalised = await db.$executeRaw`
    UPDATE "CoinTransaction"
       SET "amount" = CASE
             WHEN "type" IN ('PURCHASE','BONUS','REFUND','HOLD_RELEASE') THEN ABS("amount")
             WHEN "type" IN ('SPEND','HOLD') THEN -ABS("amount")
             ELSE "amount"
           END
     WHERE "type" IN ('PURCHASE','BONUS','REFUND','HOLD_RELEASE','SPEND','HOLD')
       AND "amount" <> CASE
             WHEN "type" IN ('PURCHASE','BONUS','REFUND','HOLD_RELEASE') THEN ABS("amount")
             WHEN "type" IN ('SPEND','HOLD') THEN -ABS("amount")
             ELSE "amount"
           END
  `;

  const accounts = await db.$executeRaw`
    INSERT INTO "CoinAccount" ("userId", "balance", "heldBalance", "lifetimeEarned", "lifetimeSpent", "version", "createdAt", "updatedAt")
    SELECT t."userId",
           COALESCE(SUM(t."amount"), 0)::int,
           0,
           COALESCE(SUM(CASE WHEN t."type" IN ('PURCHASE','BONUS') THEN t."amount"
                             WHEN t."type" = 'ADJUSTMENT' AND t."amount" > 0 THEN t."amount"
                             ELSE 0 END), 0)::int,
           COALESCE(SUM(CASE WHEN t."type" = 'SPEND' THEN -t."amount"
                             WHEN t."type" = 'ADJUSTMENT' AND t."amount" < 0 THEN -t."amount"
                             ELSE 0 END), 0)::int,
           0, NOW(), NOW()
      FROM "CoinTransaction" t
     GROUP BY t."userId"
    ON CONFLICT ("userId") DO UPDATE
       SET "balance"        = EXCLUDED."balance",
           "lifetimeEarned" = EXCLUDED."lifetimeEarned",
           "lifetimeSpent"  = EXCLUDED."lifetimeSpent",
           "updatedAt"      = NOW()
  `;

  return { accounts, rowsNormalised: normalised };
}

/**
 * Consistency audit: does every materialised balance still match its ledger?
 *
 * Run from a cron. A non-empty result means a write path bypassed this module
 * and the ledger and the account have drifted, which is the one failure mode
 * a materialised balance introduces and therefore the one worth watching.
 */
export async function auditCoinAccounts(): Promise<
  Array<{ userId: string; accountBalance: number; ledgerBalance: number; drift: number }>
> {
  return db.$queryRaw`
    SELECT a."userId"::text                       AS "userId",
           a."balance"                            AS "accountBalance",
           COALESCE(SUM(t."amount"), 0)::int      AS "ledgerBalance",
           (a."balance" - COALESCE(SUM(t."amount"), 0))::int AS "drift"
      FROM "CoinAccount" a
      LEFT JOIN "CoinTransaction" t ON t."userId" = a."userId"
     GROUP BY a."userId", a."balance"
    HAVING a."balance" <> COALESCE(SUM(t."amount"), 0)
  `;
}

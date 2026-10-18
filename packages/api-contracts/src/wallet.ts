import { z } from "zod";

export const CoinBalanceResponseSchema = z.object({
  balance: z.number().int().min(0),
  currency: z.literal("INR").default("INR"),
  coinUnitValueInr: z.number().default(1),
});
export type CoinBalanceResponse = z.infer<typeof CoinBalanceResponseSchema>;

export const CoinPackSchema = z.object({
  id: z.string(),
  coins: z.number().int().positive(),
  priceInr: z.number().int().positive(),
  bonusCoins: z.number().int().min(0).default(0),
  popular: z.boolean().default(false),
});
export type CoinPack = z.infer<typeof CoinPackSchema>;

export const CreateCoinOrderRequestSchema = z.object({
  packId: z.string(),
  amountInr: z.number().int().positive(),
});
export type CreateCoinOrderRequest = z.infer<typeof CreateCoinOrderRequestSchema>;

export const CoinTransactionTypeSchema = z.enum([
  "TOPUP",
  "BOOKING_HOLD",
  "BOOKING_PAYMENT",
  "REFUND",
  "ADMIN_ADJUSTMENT",
]);
export type CoinTransactionType = z.infer<typeof CoinTransactionTypeSchema>;

export const CoinTransactionSchema = z.object({
  id: z.string(),
  amount: z.number().int(),
  type: CoinTransactionTypeSchema,
  description: z.string(),
  createdAt: z.string().datetime(),
  referenceId: z.string().nullable().optional(),
});
export type CoinTransaction = z.infer<typeof CoinTransactionSchema>;

export const WalletHistoryResponseSchema = z.object({
  balance: z.number().int().min(0),
  transactions: z.array(CoinTransactionSchema),
});
export type WalletHistoryResponse = z.infer<typeof WalletHistoryResponseSchema>;

/** 1 coin = ₹1, so every pack costs exactly its coin count in rupees. */
export const COIN_VALUE_INR = 1;

export interface CoinPackage {
  id: string;
  coins: number;
  priceInr: number;
  name: string;
}

/**
 * The coin packs every app sells. Servers price orders from this list, never
 * from the browser, so it is shared rather than copied per app.
 */
export const COIN_PACKAGES: readonly CoinPackage[] = [
  { id: "tier1", coins: 100, priceInr: 100, name: "Basic Pack" },
  { id: "tier2", coins: 500, priceInr: 500, name: "Popular Pack" },
  { id: "tier3", coins: 1000, priceInr: 1000, name: "Pro Pack" },
];

/**
 * Resolve a create-order request body to a pack. `packageId` wins; a bare
 * `amount` must equal a pack price. Anything tampered with (another price,
 * another currency, an unknown pack) resolves to null.
 */
export function resolveCoinPackage(body: unknown): CoinPackage | null {
  if (!body || typeof body !== "object") return null;
  const { packageId, amount, currency = "INR" } = body as Record<string, unknown>;
  if (currency !== "INR") return null;
  const pack = packageId !== undefined
    ? COIN_PACKAGES.find((entry) => entry.id === packageId)
    : COIN_PACKAGES.find((entry) => entry.priceInr === amount);
  if (!pack || (amount !== undefined && amount !== pack.priceInr)) return null;
  return pack;
}

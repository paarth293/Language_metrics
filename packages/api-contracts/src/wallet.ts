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

/** Bounds for a custom top-up in whole rupees. ₹1 is Cashfree's minimum order. */
export const MIN_CUSTOM_TOPUP_INR = 1;
export const MAX_CUSTOM_TOPUP_INR = 100_000;

/** Whether `value` is an allowed custom top-up: whole rupees within the bounds. */
export function isValidCustomTopUp(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_CUSTOM_TOPUP_INR && value <= MAX_CUSTOM_TOPUP_INR;
}

/**
 * Resolve a create-order request body to what is being bought. Either a pack
 * (`packageId`, or a bare `amount` equal to a pack price) or a custom amount
 * (`customAmountInr`, whole rupees, bought at 1 coin = ₹1). Anything tampered
 * with or ambiguous (another price, another currency, an unknown pack, a pack
 * and a custom amount together) resolves to null.
 */
export function resolveCoinPackage(body: unknown): CoinPackage | null {
  if (!body || typeof body !== "object") return null;
  const { packageId, amount, customAmountInr, currency = "INR" } = body as Record<string, unknown>;
  if (currency !== "INR") return null;
  if (customAmountInr !== undefined) {
    if (packageId !== undefined || amount !== undefined || !isValidCustomTopUp(customAmountInr)) return null;
    const coins = customAmountInr / COIN_VALUE_INR;
    return { id: "custom", coins, priceInr: customAmountInr, name: "Custom amount" };
  }
  const pack = packageId !== undefined
    ? COIN_PACKAGES.find((entry) => entry.id === packageId)
    : COIN_PACKAGES.find((entry) => entry.priceInr === amount);
  if (!pack || (amount !== undefined && amount !== pack.priceInr)) return null;
  return pack;
}

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

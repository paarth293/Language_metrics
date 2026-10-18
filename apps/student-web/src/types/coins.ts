export interface CoinBalanceResponse {
  balance: number;
}

// One list for every app; see packages/api-contracts/src/wallet.ts.
export { COIN_PACKAGES, COIN_VALUE_INR, type CoinPackage } from "@repo/api-contracts";

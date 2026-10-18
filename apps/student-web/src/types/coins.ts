export interface CoinBalanceResponse {
  balance: number;
}

export interface CoinPackage {
  id: string;
  coins: number;
  priceInr: number;
  name: string;
}

/** 1 coin = ₹1, so every pack costs exactly its coin count in rupees. */
export const COIN_VALUE_INR = 1;

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'tier1', coins: 100, priceInr: 100, name: 'Basic Pack' },
  { id: 'tier2', coins: 500, priceInr: 500, name: 'Popular Pack' },
  { id: 'tier3', coins: 1000, priceInr: 1000, name: 'Pro Pack' }
];

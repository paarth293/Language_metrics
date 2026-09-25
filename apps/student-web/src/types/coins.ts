export interface CoinBalanceResponse {
  balance: number;
}

export interface CoinPackage {
  id: string;
  coins: number;
  priceInr: number;
  name: string;
}

export const COIN_PACKAGES: CoinPackage[] = [
  { id: 'tier1', coins: 100, priceInr: 299, name: 'Basic Pack' },
  { id: 'tier2', coins: 500, priceInr: 1499, name: 'Popular Pack' },
  { id: 'tier3', coins: 1000, priceInr: 2999, name: 'Pro Pack' }
];

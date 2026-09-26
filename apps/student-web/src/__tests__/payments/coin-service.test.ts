import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCoinBalance, creditCoins, debitCoins } from '../../lib/coin-service';
import { credit, debit, getCoinBalance as ledgerBalance } from '@repo/database';

vi.mock('@repo/database', () => ({
  credit: vi.fn().mockResolvedValue(undefined),
  debit: vi.fn().mockResolvedValue(undefined),
  getCoinBalance: vi.fn().mockResolvedValue({ balance: 120, heldBalance: 0, lifetimeEarned: 150, lifetimeSpent: 30 }),
}));

const testUserId = "11111111-1111-1111-1111-111111111111";

describe('Coin Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates balance correctly', async () => {
    (ledgerBalance as any).mockResolvedValue({ balance: 120, heldBalance: 0, lifetimeEarned: 150, lifetimeSpent: 30 });

    const balance = await getCoinBalance(testUserId);
    expect(balance).toBe(120);
  });

  it('credits coins successfully', async () => {
    await creditCoins(testUserId, 50, 'test credit');
    expect(credit).toHaveBeenCalledWith({
      userId: testUserId,
      amount: 50,
      type: 'PURCHASE',
      description: 'test credit',
      idempotencyKey: undefined,
    });
  });

  it('debits coins if balance is sufficient', async () => {
    (debit as any).mockResolvedValue(undefined);
    const success = await debitCoins(testUserId, 50, 'test debit');
    
    expect(success).toBe(true);
    expect(debit).toHaveBeenCalledWith({
      userId: testUserId,
      amount: 50,
      description: 'test debit',
      idempotencyKey: undefined,
    });
  });

  it('fails to debit coins if balance is insufficient', async () => {
    const err = new Error('Insufficient balance');
    err.name = 'InsufficientCoinsError';
    (debit as any).mockRejectedValueOnce(err);
    const success = await debitCoins(testUserId, 50, 'test debit');
    
    expect(success).toBe(false);
  });
});

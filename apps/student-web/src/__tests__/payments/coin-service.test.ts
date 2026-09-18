import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getCoinBalance, creditCoins, debitCoins } from '../../lib/coin-service';
import { db } from '../../lib/db';

vi.mock('../../lib/db', () => ({
  db: {
    coinTransaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    }
  }
}));

describe('Coin Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates balance correctly', async () => {
    (db.coinTransaction.findMany as any).mockResolvedValue([
      { type: 'PURCHASE', amount: 100 },
      { type: 'BONUS', amount: 50 },
      { type: 'SPEND', amount: 30 }
    ]);

    const balance = await getCoinBalance('user1');
    expect(balance).toBe(120); // 100 + 50 - 30
  });

  it('credits coins successfully', async () => {
    await creditCoins('user1', 50, 'test credit');
    expect(db.coinTransaction.create).toHaveBeenCalledWith({
      data: { userId: 'user1', amount: 50, type: 'PURCHASE', description: 'test credit' }
    });
  });

  it('debits coins if balance is sufficient', async () => {
    (db.coinTransaction.findMany as any).mockResolvedValue([{ type: 'PURCHASE', amount: 100 }]);
    const success = await debitCoins('user1', 50, 'test debit');
    
    expect(success).toBe(true);
    expect(db.coinTransaction.create).toHaveBeenCalledWith({
      data: { userId: 'user1', amount: 50, type: 'SPEND', description: 'test debit' }
    });
  });

  it('fails to debit coins if balance is insufficient', async () => {
    (db.coinTransaction.findMany as any).mockResolvedValue([{ type: 'PURCHASE', amount: 20 }]);
    const success = await debitCoins('user1', 50, 'test debit');
    
    expect(success).toBe(false);
    expect(db.coinTransaction.create).not.toHaveBeenCalled();
  });
});

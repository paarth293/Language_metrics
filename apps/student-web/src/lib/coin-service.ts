import { db } from './db';

export async function getCoinBalance(userId: string): Promise<number> {
  const transactions = await db.coinTransaction.findMany({
    where: { userId }
  });

  return transactions.reduce((acc, tx) => {
    if (tx.type === 'PURCHASE' || tx.type === 'BONUS' || tx.type === 'REFUND') {
      return acc + tx.amount;
    } else if (tx.type === 'SPEND') {
      return acc - tx.amount;
    }
    return acc;
  }, 0);
}

export async function creditCoins(userId: string, amount: number, description?: string): Promise<void> {
  await db.coinTransaction.create({
    data: {
      userId,
      amount,
      type: 'PURCHASE',
      description
    }
  });
}

export async function debitCoins(userId: string, amount: number, description?: string): Promise<boolean> {
  const balance = await getCoinBalance(userId);
  if (balance < amount) {
    return false;
  }

  await db.coinTransaction.create({
    data: {
      userId,
      amount,
      type: 'SPEND',
      description
    }
  });

  return true;
}


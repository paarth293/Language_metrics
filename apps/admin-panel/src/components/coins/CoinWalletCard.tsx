import { db, getCoinBalance } from "@repo/database";
import { hasPermission, type SessionUser } from "@/lib/rbac";
import { CoinAdjustForm } from "./CoinAdjustForm";

const TYPE_LABELS: Record<string, string> = {
  PURCHASE: "Purchase",
  BONUS: "Bonus",
  SPEND: "Spent",
  REFUND: "Refund",
  HOLD: "Held for class",
  HOLD_RELEASE: "Hold released",
  ADJUSTMENT: "Admin adjustment",
};

const cardStyle = {
  background: "var(--lm-surface)",
  border: "1px solid var(--lm-border2)",
};

/** Balance, recent ledger entries and — for admins with coins:adjust — the adjustment form. */
export async function CoinWalletCard({ userId, admin }: { userId: string; admin: SessionUser }) {
  const [balance, transactions, self] = await Promise.all([
    getCoinBalance(userId),
    db.coinTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, type: true, amount: true, description: true, createdAt: true, balanceAfter: true },
    }),
    db.user.findUnique({ where: { id: admin.id }, select: { totpEnabled: true } }),
  ]);

  const canAdjust = hasPermission(admin, "coins:adjust") && admin.id !== userId;

  return (
    <div style={cardStyle} className="rounded-lg p-6">
      <h2 className="text-lg font-semibold text-white mb-4">Coin Wallet</h2>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div>
          <p className="text-xs text-gray-500 mb-1">Spendable</p>
          <p className="text-2xl font-bold text-white tabular-nums">{balance.balance.toLocaleString("en-IN")}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Held for classes</p>
          <p className="text-2xl font-bold text-gray-300 tabular-nums">{balance.heldBalance.toLocaleString("en-IN")}</p>
        </div>
      </div>

      {canAdjust && (
        <div className="mb-5 pb-5 border-b border-gray-700">
          <CoinAdjustForm userId={userId} spendable={balance.balance} requiresTotp={Boolean(self?.totpEnabled)} />
        </div>
      )}

      <h3 className="text-sm font-semibold text-white mb-3">Recent transactions</h3>
      {transactions.length === 0 ? (
        <p className="text-sm text-gray-400">No coin activity yet.</p>
      ) : (
        <ul className="space-y-3">
          {transactions.map((t) => (
            <li key={t.id} className="text-sm border-b border-gray-700 pb-2 last:border-0 last:pb-0">
              <div className="flex justify-between gap-3">
                <span className="text-white">{TYPE_LABELS[t.type] ?? t.type}</span>
                <span className={`tabular-nums font-medium ${t.amount >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount.toLocaleString("en-IN")}
                </span>
              </div>
              {t.description && <p className="text-xs text-gray-400 mt-1 break-words">{t.description}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {t.createdAt.toLocaleString("en-IN")}
                {t.balanceAfter !== null && ` · balance ${t.balanceAfter.toLocaleString("en-IN")}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

'use client';
import { useState, useEffect } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { CashfreeCheckout } from './CashfreeCheckout';
import { COIN_PACKAGES, CoinPackage } from '@/types/coins';

interface CoinPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CoinPurchaseModal({ isOpen, onClose, onSuccess }: CoinPurchaseModalProps) {
  const [balance, setBalance] = useState<number | null>(null);
  // A failed payment is shown in the dialog instead of a blocking browser alert.
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    fetch('/api/coins/balance')
      .then((res) => res.json())
      .then((data) => {
        if (data.balance !== undefined) {
          setBalance(data.balance);
        }
      })
      .catch(console.error);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="coin-purchase-title"
        className="bg-surface text-text rounded-2xl border border-border p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 id="coin-purchase-title" className="text-xl font-bold">Purchase Coins</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-inset"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mb-4 text-sm text-text-secondary">
          Current balance: {balance !== null ? balance : '…'} coins
        </p>

        {error && (
          <p role="alert" className="mb-4 flex items-start gap-2 rounded-lg border border-alert/30 bg-alert-subtle px-3 py-2 text-sm text-alert-hover">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        <div className="space-y-3">
          {COIN_PACKAGES.map((pkg: CoinPackage) => (
            <div key={pkg.id} className="border border-border p-4 rounded-xl flex justify-between items-center gap-4">
              <div>
                <h3 className="font-semibold">{pkg.name}</h3>
                <p className="text-sm text-text-muted">{pkg.coins} Coins</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold">₹{pkg.priceInr}</span>
                <CashfreeCheckout
                  amount={pkg.priceInr}
                  packageId={pkg.id}
                  onSuccess={() => {
                    onSuccess();
                    onClose();
                  }}
                  onError={(err) => {
                    setError(`Payment failed: ${err.message}`);
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

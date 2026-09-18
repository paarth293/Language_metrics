'use client';
import { useState, useEffect } from 'react';
import { RazorpayCheckout } from './RazorpayCheckout';
import { COIN_PACKAGES, CoinPackage } from '@/types/coins';

interface CoinPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CoinPurchaseModal({ isOpen, onClose, onSuccess }: CoinPurchaseModalProps) {
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/coins/balance')
        .then((res) => res.json())
        .then((data) => {
          if (data.balance !== undefined) {
            setBalance(data.balance);
          }
        })
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Purchase Coins</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-black">&times;</button>
        </div>
        
        <p className="mb-4 text-sm text-gray-600">Current Balance: {balance !== null ? balance : '...'} coins</p>
        
        <div className="space-y-4">
          {COIN_PACKAGES.map((pkg: CoinPackage) => (
            <div key={pkg.id} className="border p-4 rounded flex justify-between items-center">
              <div>
                <h3 className="font-semibold">{pkg.name}</h3>
                <p className="text-sm text-gray-500">{pkg.coins} Coins</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold">?{pkg.priceInr}</span>
                <RazorpayCheckout 
                  amount={pkg.priceInr} 
                  packageId={pkg.id} 
                  coinsToCredit={pkg.coins}
                  onSuccess={() => {
                    alert('Payment successful!');
                    onSuccess();
                    onClose();
                  }}
                  onError={(err) => {
                    alert('Payment failed: ' + err.message);
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

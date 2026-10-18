'use client';
import { useRef, useState } from 'react';
import { openCashfreeCheckout, type CashfreeMode } from '@repo/ui/cashfree';

interface CashfreeCheckoutProps {
  amount: number;
  packageId?: string;
  onSuccess: (response: { success: boolean; message?: string }) => void;
  onError: (error: Error) => void;
  buttonText?: string;
}

export function CashfreeCheckout({ amount, packageId, onSuccess, onError, buttonText = 'Pay Now' }: CashfreeCheckoutProps) {
  const [loading, setLoading] = useState(false);

  const active = useRef(false);
  const finish = () => { active.current = false; setLoading(false); };
  const handlePayment = async () => {
    if (active.current) return;
    active.current = true;
    setLoading(true);
    try {
      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, packageId })
      });
      const orderData: { orderId?: string; paymentSessionId?: string; mode?: CashfreeMode; error?: string } = await orderResponse.json();

      if (!orderResponse.ok || orderData.error || !orderData.orderId || !orderData.paymentSessionId || !orderData.mode) {
        throw new Error(orderData.error || 'Payment order could not be created.');
      }

      const result = await openCashfreeCheckout(orderData.paymentSessionId, orderData.mode);
      if (result.error) {
        throw new Error(result.error.message || 'Payment was not completed.');
      }

      const verifyRes = await fetch('/api/payments/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: orderData.orderId })
      }).then((t) => t.json());

      if (verifyRes.success) {
        onSuccess(verifyRes);
      } else {
        onError(new Error(verifyRes.error || 'Payment verification failed.'));
      }
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Payment failed. Please try again.'));
    } finally {
      finish();
    }
  };

  return (
    <button
      type="button"
      onClick={handlePayment}
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
    >
      {loading ? 'Processing...' : buttonText}
    </button>
  );
}

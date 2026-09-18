'use client';
import { useState } from 'react';
import { loadRazorpayScript } from '@/lib/razorpay-client';

interface RazorpayCheckoutProps {
  amount: number;
  packageId?: string;
  onSuccess: (response: any) => void;
  onError: (error: any) => void;
  buttonText?: string;
  coinsToCredit: number;
}

export function RazorpayCheckout({ amount, packageId, onSuccess, onError, buttonText = 'Pay Now', coinsToCredit }: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);

  const handlePayment = async () => {
    setLoading(true);
    const res = await loadRazorpayScript();

    if (!res) {
      alert('Razorpay SDK failed to load. Are you online?');
      setLoading(false);
      return;
    }

    try {
      const orderData = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, packageId })
      }).then((t) => t.json());

      if (orderData.error) {
        throw new Error(orderData.error);
      }

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '', // Needs to be exposed
        amount: orderData.amount.toString(),
        currency: orderData.currency,
        name: 'Language Metrics',
        description: 'Coin Purchase',
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            const verifyRes = await fetch('/api/payments/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                ...response,
                coinsToCredit
              })
            }).then((t) => t.json());

            if (verifyRes.success) {
              onSuccess(verifyRes);
            } else {
              onError(verifyRes);
            }
          } catch (err) {
            onError(err);
          }
        },
        theme: {
          color: '#3399cc'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
        onError(response.error);
      });
      paymentObject.open();
    } catch (err) {
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePayment}
      disabled={loading}
      className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
    >
      {loading ? 'Processing...' : buttonText}
    </button>
  );
}

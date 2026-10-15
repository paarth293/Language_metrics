'use client';
import { useRef, useState } from 'react';
import type { RazorpayPaymentResponse, RazorpayFailure } from '@repo/ui/razorpay';
import { loadRazorpayScript } from '@/lib/razorpay-client';

interface RazorpayCheckoutProps {
  amount: number;
  packageId?: string;
  onSuccess: (response: { success: boolean; message?: string }) => void;
  onError: (error: Error) => void;
  buttonText?: string;
}

export function RazorpayCheckout({ amount, packageId, onSuccess, onError, buttonText = 'Pay Now' }: RazorpayCheckoutProps) {
  const [loading, setLoading] = useState(false);

  const active = useRef(false);
  const finish = () => { active.current = false; setLoading(false); };
  const handlePayment = async () => {
    if (active.current) return;
    active.current = true;
    setLoading(true);
    try {
      const res = await loadRazorpayScript();

      if (!res) {
        onError(new Error('Payment form could not load. Check your connection and try again.'));
        finish();
        return;
      }

      const orderResponse = await fetch('/api/payments/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, packageId })
      });
      const orderData = await orderResponse.json();

      if (!orderResponse.ok || orderData.error) {
        throw new Error(orderData.error || 'Payment order could not be created.');
      }

      const publicKey = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
      if (!publicKey) throw new Error('Payments are unavailable. Please try again later.');
      const options = {
        key: publicKey,
        amount: orderData.amount.toString(),
        currency: orderData.currency,
        name: 'Language Metrics',
        description: 'Coin Purchase',
        order_id: orderData.id,
        handler: async function (response: RazorpayPaymentResponse) {
          try {
            const verifyRes = await fetch('/api/payments/verify-payment', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(response)
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
        },
        modal: { ondismiss: finish },
        theme: {
          color: '#3399cc'
        }
      };

      const paymentObject = new window.Razorpay(options);
      paymentObject.on('payment.failed', function (response: RazorpayFailure) {
        onError(new Error(response.error?.description || 'Payment failed.'));
        finish();
      });
      paymentObject.open();
    } catch (err) {
      onError(err instanceof Error ? err : new Error('Payment failed. Please try again.'));
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

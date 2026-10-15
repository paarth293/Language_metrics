export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayFailure {
  error: { description: string; code?: string };
}

export interface RazorpayOptions {
  key: string;
  amount: string | number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  handler: (response: RazorpayPaymentResponse) => void | Promise<void>;
  theme?: { color: string };
  prefill?: { name?: string; email?: string; contact?: string };
  modal?: { ondismiss: () => void };
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open(): void;
      on(event: "payment.failed", listener: (response: RazorpayFailure) => void): void;
    };
  }
}

let loading: Promise<boolean> | undefined;

/** Load a single checkout script for all purchase buttons in this browser. */
export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(Boolean(window.Razorpay));
    script.onerror = () => { script.remove(); resolve(false); };
    document.body.appendChild(script);
  }).then((loaded) => {
    if (!loaded) loading = undefined;
    return loaded;
  });
  return loading;
}

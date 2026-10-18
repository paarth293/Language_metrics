export type CashfreeMode = "sandbox" | "production";

export interface CashfreeCheckoutResult {
  error?: { message?: string; code?: string };
  redirect?: boolean;
  paymentDetails?: { paymentMessage?: string };
}

interface CashfreeInstance {
  checkout(options: { paymentSessionId: string; redirectTarget?: "_modal" | "_self" | "_blank" | "_top" }): Promise<CashfreeCheckoutResult>;
}

declare global {
  interface Window {
    Cashfree?: (options: { mode: CashfreeMode }) => CashfreeInstance;
  }
}

let loading: Promise<boolean> | undefined;

/** Load a single checkout script for all purchase buttons in this browser. */
export function loadCashfreeScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Cashfree) return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const script = document.createElement("script");
    script.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(Boolean(window.Cashfree));
    script.onerror = () => { script.remove(); resolve(false); };
    document.body.appendChild(script);
  }).then((loaded) => {
    if (!loaded) loading = undefined;
    return loaded;
  });
  return loading;
}

/**
 * Open Cashfree's payment popup. Resolves once the popup closes; a result
 * with `paymentDetails` means the customer finished paying, and the server
 * must still confirm it before anything is credited.
 */
export async function openCashfreeCheckout(paymentSessionId: string, mode: CashfreeMode): Promise<CashfreeCheckoutResult> {
  if (!(await loadCashfreeScript()) || !window.Cashfree) {
    throw new Error("Payment form could not load. Check your connection and try again.");
  }
  return window.Cashfree({ mode }).checkout({ paymentSessionId, redirectTarget: "_modal" });
}

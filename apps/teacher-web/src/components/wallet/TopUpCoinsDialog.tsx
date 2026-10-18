"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Coins, Loader2, ShieldCheck, X } from "lucide-react";
import { COIN_PACKAGES, type CoinPackage } from "@repo/api-contracts";
import { openCashfreeCheckout, type CashfreeMode } from "@repo/ui/cashfree";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/**
 * Coin top-up through Cashfree.
 *
 * The browser only picks a pack and names the order to confirm: the price
 * comes from the server's pack list and the server asks Cashfree whether the
 * order was paid before any coins are credited. A UPI payment can stay
 * pending for a while, so that is shown as "processing", never as a failure;
 * the webhook or the reconciliation job credits it once Cashfree confirms.
 */

type Phase =
  | { kind: "choose"; notice?: string }
  | { kind: "checkout" }
  | { kind: "verifying" }
  | { kind: "pending"; orderId: string }
  | { kind: "paid"; coins: number }
  | { kind: "error"; message: string };

const PENDING_RECHECKS = 4;
const RECHECK_DELAY_MS = 4_000;

interface TopUpCoinsDialogProps {
  open: boolean;
  onClose: () => void;
  /** Called once coins have been credited, so the wallet can refresh. */
  onPaid: () => void;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

export function TopUpCoinsDialog({ open, onClose, onPaid }: TopUpCoinsDialogProps) {
  const [selected, setSelected] = useState<CoinPackage>(COIN_PACKAGES[1] ?? COIN_PACKAGES[0]!);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  const dialogRef = useRef<HTMLDivElement>(null);
  /** Bumped on close, so an in-flight recheck loop stops touching state. */
  const run = useRef(0);
  const busy = phase.kind === "checkout" || phase.kind === "verifying";

  useEffect(() => () => { run.current++; }, []);

  const requestClose = useCallback(() => {
    if (busy) return; // the Cashfree popup is open or we are confirming
    run.current++;
    setPhase({ kind: "choose" });
    onClose();
  }, [busy, onClose]);

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") requestClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, requestClose]);

  const confirm = useCallback(async (orderId: string, coins: number) => {
    const token = ++run.current;
    for (let attempt = 1; attempt <= PENDING_RECHECKS; attempt++) {
      if (attempt > 1) {
        await new Promise((resolve) => setTimeout(resolve, RECHECK_DELAY_MS));
        if (token !== run.current) return;
      }
      setPhase({ kind: "verifying" });
      try {
        const { ok, status, data } = await postJson("/api/payments/verify-payment", { orderId });
        if (token !== run.current) return;
        if (ok) {
          setPhase({ kind: "paid", coins });
          onPaid();
          return;
        }
        if (status !== 409) {
          setPhase({ kind: "error", message: data.error || "We could not confirm this payment. If money was taken it will be credited automatically." });
          return;
        }
        // Still pending at Cashfree (common for UPI): show it, then check again.
        setPhase({ kind: "pending", orderId });
      } catch {
        if (token === run.current) setPhase({ kind: "pending", orderId });
      }
    }
  }, [onPaid]);

  const pay = async () => {
    setPhase({ kind: "checkout" });
    try {
      const { ok, data } = await postJson("/api/payments/create-order", { packageId: selected.id });
      const { orderId, paymentSessionId, mode } = data as { orderId?: string; paymentSessionId?: string; mode?: CashfreeMode };
      if (!ok || !orderId || !paymentSessionId || !mode) {
        setPhase({ kind: "error", message: data.error || "Payments are unavailable right now. Please try again later." });
        return;
      }
      const result = await openCashfreeCheckout(paymentSessionId, mode);
      if (result.error) {
        // Closed or declined before paying. Nothing was charged.
        setPhase({ kind: "choose", notice: result.error.message || "Payment was not completed. No money was taken." });
        return;
      }
      await confirm(orderId, selected.coins);
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error ? error.message : "Payment failed. Please try again." });
    }
  };

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center transition-opacity duration-200 sm:items-center sm:p-6",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      inert={!open}
    >
      <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" onClick={requestClose} aria-hidden />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="topup-title"
        tabIndex={-1}
        className={cn(
          "relative w-full overflow-hidden bg-surface shadow-lg outline-none transition-transform duration-200 rounded-t-2xl sm:max-w-[480px] sm:rounded-xl sm:border sm:border-border",
          open ? "translate-y-0 sm:scale-100" : "translate-y-4 sm:scale-[0.98]"
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-5 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text-subtle">Wallet</p>
            <h2 id="topup-title" className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-text">Top up coins</h2>
            <p className="mt-1 text-[12px] text-text-muted">1 coin = ₹1. Coins never expire.</p>
          </div>
          <button
            type="button"
            onClick={requestClose}
            disabled={busy}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-surface-inset hover:text-text focus-ring disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-5 sm:px-6" aria-live="polite">
          {phase.kind === "paid" ? (
            <div className="py-6 text-center">
              <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-trust" />
              <p className="text-[18px] font-bold text-text">{phase.coins.toLocaleString("en-IN")} coins added</p>
              <p className="mt-1 text-[13px] text-text-muted">Your balance has been updated.</p>
              <Button className="mt-6 w-full" onClick={requestClose}>Done</Button>
            </div>
          ) : phase.kind === "pending" ? (
            <div className="py-6 text-center">
              <Clock className="mx-auto mb-3 h-12 w-12 text-gold" />
              <p className="text-[18px] font-bold text-text">Payment processing</p>
              <p className="mx-auto mt-1 max-w-[340px] text-[13px] leading-relaxed text-text-muted">
                Cashfree has not confirmed this payment yet (UPI can take a few minutes). Your coins are added automatically once it is confirmed. Please do not pay again.
              </p>
              <div className="mt-6 flex gap-2">
                <Button variant="outline" className="flex-1" onClick={requestClose}>Close</Button>
                <Button className="flex-1" onClick={() => void confirm(phase.orderId, selected.coins)}>Check again</Button>
              </div>
            </div>
          ) : (
            <>
              <fieldset disabled={busy}>
                <legend className="sr-only">Choose a coin pack</legend>
                <div className="grid gap-2.5">
                  {COIN_PACKAGES.map((pack) => {
                    const active = pack.id === selected.id;
                    return (
                      <label
                        key={pack.id}
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-brand/40",
                          active ? "border-brand bg-brand/5" : "border-border hover:border-border-strong hover:bg-surface-inset"
                        )}
                      >
                        <input
                          type="radio"
                          name="coin-pack"
                          value={pack.id}
                          checked={active}
                          onChange={() => setSelected(pack)}
                          className="sr-only"
                        />
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand/10 text-brand" : "bg-surface-inset text-text-muted")}>
                          <Coins className="h-5 w-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[14px] font-bold text-text">{pack.coins.toLocaleString("en-IN")} coins</span>
                          <span className="block text-[12px] text-text-muted">{pack.name}</span>
                        </span>
                        <span className="font-display text-[16px] font-bold tabular-nums text-text">₹{pack.priceInr.toLocaleString("en-IN")}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              {phase.kind === "choose" && phase.notice && (
                <p className="mt-4 rounded-lg bg-surface-inset px-3 py-2 text-[12px] text-text-muted">{phase.notice}</p>
              )}
              {phase.kind === "error" && (
                <p role="alert" className="mt-4 rounded-lg border border-alert/30 bg-alert/10 px-3 py-2 text-[12px] font-medium text-alert">{phase.message}</p>
              )}

              <Button variant="gold" size="lg" className="mt-5 w-full font-bold" onClick={() => void pay()} disabled={busy}>
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> {phase.kind === "verifying" ? "Confirming payment…" : "Waiting for payment…"}</>
                ) : (
                  <>Pay ₹{selected.priceInr.toLocaleString("en-IN")}</>
                )}
              </Button>
              <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-subtle">
                <ShieldCheck className="h-3.5 w-3.5" /> Payments are processed securely by Cashfree
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

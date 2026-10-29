"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Clock, Coins, Loader2, Pencil, ShieldCheck } from "lucide-react";
import { COIN_PACKAGES, MAX_CUSTOM_TOPUP_INR, MIN_CUSTOM_TOPUP_INR, isValidCustomTopUp } from "@repo/api-contracts";
import { openCashfreeCheckout, type CashfreeMode } from "@repo/ui/cashfree";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { Dialog, InlineError } from "./primitives";

/**
 * Coin top-up through Cashfree, shared by both portals (it began as
 * teacher-web's TopUpCoinsDialog). The browser only picks a pack and names
 * the order to confirm: the price comes from the server's pack list and the
 * server asks Cashfree whether the order was paid before crediting coins.
 * A UPI payment can stay pending for a while, so that is shown as
 * "processing", never as a failure.
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

export function TopUpDialog({
  open,
  onClose,
  onPaid,
  initialChoice,
  fetchImpl,
}: {
  open: boolean;
  onClose: () => void;
  /** Called once coins have been credited, so the wallet can refresh. */
  onPaid: () => void;
  /** A pack id, or "custom". */
  initialChoice?: string;
  fetchImpl: typeof fetch;
}) {
  const [choice, setChoice] = useState<string>(initialChoice ?? COIN_PACKAGES[1]?.id ?? "tier1");
  const [customText, setCustomText] = useState("");
  const [inFlightCoins, setInFlightCoins] = useState(0);
  const [phase, setPhase] = useState<Phase>({ kind: "choose" });
  /** Bumped on close, so an in-flight recheck loop stops touching state. */
  const run = useRef(0);
  const busy = phase.kind === "checkout" || phase.kind === "verifying";

  useEffect(() => () => void run.current++, []);

  // Opening from a pack on the wallet page preselects it.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open && initialChoice) setChoice(initialChoice);
  }, [open, initialChoice]);

  const postJson = useCallback(
    async (url: string, body: unknown) => {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return { status: response.status, ok: response.ok, data };
    },
    [fetchImpl]
  );

  const requestClose = useCallback(() => {
    if (busy) return; // the Cashfree popup is open or we are confirming
    run.current++;
    setPhase({ kind: "choose" });
    onClose();
  }, [busy, onClose]);

  const confirm = useCallback(
    async (orderId: string, coins: number) => {
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
    },
    [onPaid, postJson]
  );

  const customAmount = /^\d+$/.test(customText) ? Number(customText) : NaN;
  const pack = COIN_PACKAGES.find((p) => p.id === choice);
  const purchase =
    choice === "custom"
      ? isValidCustomTopUp(customAmount)
        ? { body: { customAmountInr: customAmount }, coins: customAmount, priceInr: customAmount }
        : null
      : pack
        ? { body: { packageId: pack.id }, coins: pack.coins, priceInr: pack.priceInr }
        : null;

  const pay = async () => {
    if (!purchase) return;
    setInFlightCoins(purchase.coins);
    setPhase({ kind: "checkout" });
    try {
      const { ok, data } = await postJson("/api/payments/create-order", purchase.body);
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
      await confirm(orderId, purchase.coins);
    } catch (error) {
      setPhase({ kind: "error", message: error instanceof Error ? error.message : "Payment failed. Please try again." });
    }
  };

  const options = [
    ...COIN_PACKAGES.map((p) => ({ id: p.id, title: `${p.coins.toLocaleString("en-IN")} coins`, note: p.name, price: `₹${p.priceInr.toLocaleString("en-IN")}`, icon: Coins })),
    {
      id: "custom",
      title: "Custom amount",
      note: "Any amount, 1 coin per ₹1",
      price: choice === "custom" && isValidCustomTopUp(customAmount) ? `₹${customAmount.toLocaleString("en-IN")}` : "₹ …",
      icon: Pencil,
    },
  ];

  return (
    <Dialog open={open} onClose={requestClose} busy={busy} title="Top up coins" description="1 coin = ₹1. Coins never expire.">
      <div aria-live="polite">
        {phase.kind === "paid" ? (
          <div className="py-4 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-trust" />
            <p className="text-[18px] font-bold text-text">{phase.coins.toLocaleString("en-IN")} coins added</p>
            <p className="mt-1 text-[13px] text-text-muted">Your balance has been updated.</p>
            <Button className="mt-6 w-full" onClick={requestClose}>
              Done
            </Button>
          </div>
        ) : phase.kind === "pending" ? (
          <div className="py-4 text-center">
            <Clock className="mx-auto mb-3 h-12 w-12 text-gold" />
            <p className="text-[18px] font-bold text-text">Payment processing</p>
            <p className="mx-auto mt-1 max-w-[340px] text-[13px] leading-relaxed text-text-muted">
              Cashfree has not confirmed this payment yet (UPI can take a few minutes). Your coins are added automatically once it is confirmed. Please do not pay again.
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" className="flex-1" onClick={requestClose}>
                Close
              </Button>
              <Button className="flex-1" onClick={() => void confirm(phase.orderId, inFlightCoins)}>
                Check again
              </Button>
            </div>
          </div>
        ) : (
          <>
            <fieldset disabled={busy}>
              <legend className="sr-only">Choose a coin pack or a custom amount</legend>
              <div className="grid gap-2.5">
                {options.map((o) => {
                  const active = o.id === choice;
                  return (
                    <label
                      key={o.id}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition-colors focus-within:ring-2 focus-within:ring-brand/40",
                        active ? "border-brand bg-brand/5" : "border-border hover:border-border-strong hover:bg-surface-inset"
                      )}
                    >
                      <input type="radio" name="coin-pack" value={o.id} checked={active} onChange={() => setChoice(o.id)} className="sr-only" />
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", active ? "bg-brand/10 text-brand" : "bg-surface-inset text-text-muted")}>
                        <o.icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-bold text-text">{o.title}</span>
                        <span className="block text-[12px] text-text-muted">{o.note}</span>
                      </span>
                      <span className="text-[16px] font-bold tabular-nums text-text">{o.price}</span>
                    </label>
                  );
                })}
              </div>

              {choice === "custom" && (
                <div className="mt-3">
                  <label htmlFor="topup-custom-amount" className="mb-1.5 block text-[12px] font-semibold text-text">
                    Amount in rupees
                  </label>
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/30">
                    <span className="text-[16px] font-bold text-text-muted" aria-hidden>
                      ₹
                    </span>
                    <input
                      id="topup-custom-amount"
                      type="text"
                      inputMode="numeric"
                      autoComplete="off"
                      autoFocus
                      placeholder="Enter amount"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, String(MAX_CUSTOM_TOPUP_INR).length))}
                      aria-describedby="topup-custom-hint"
                      aria-invalid={customText !== "" && !isValidCustomTopUp(customAmount)}
                      className="h-11 w-full bg-transparent text-[16px] font-bold tabular-nums text-text outline-none placeholder:font-normal placeholder:text-text-subtle"
                    />
                  </div>
                  <p
                    id="topup-custom-hint"
                    className={cn("mt-1.5 text-[12px]", customText !== "" && !isValidCustomTopUp(customAmount) ? "font-medium text-alert" : "text-text-muted")}
                  >
                    {customText !== "" && isValidCustomTopUp(customAmount)
                      ? `You get ${customAmount.toLocaleString("en-IN")} coins.`
                      : `Enter a whole amount from ₹${MIN_CUSTOM_TOPUP_INR.toLocaleString("en-IN")} to ₹${MAX_CUSTOM_TOPUP_INR.toLocaleString("en-IN")}.`}
                  </p>
                </div>
              )}
            </fieldset>

            {phase.kind === "choose" && phase.notice && <p className="mt-4 rounded-lg bg-surface-inset px-3 py-2 text-[12px] text-text-muted">{phase.notice}</p>}
            {phase.kind === "error" && <InlineError className="mt-4">{phase.message}</InlineError>}

            <Button variant="gold" size="lg" className="mt-5 w-full font-bold" onClick={() => void pay()} disabled={busy || !purchase}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> {phase.kind === "verifying" ? "Confirming payment…" : "Waiting for payment…"}
                </>
              ) : purchase ? (
                `Pay ₹${purchase.priceInr.toLocaleString("en-IN")}`
              ) : (
                "Enter an amount"
              )}
            </Button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-text-subtle">
              <ShieldCheck className="h-3.5 w-3.5" /> Payments are processed securely by Cashfree
            </p>
          </>
        )}
      </div>
    </Dialog>
  );
}

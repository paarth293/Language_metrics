"use client";

import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarCheck2,
  Coins,
  Gift,
  Lock,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  SlidersHorizontal,
  Unlock,
} from "lucide-react";
import { COIN_PACKAGES } from "@repo/api-contracts";
import { useJsonResource } from "@repo/ui/useResource";
import { StaleDataNotice } from "@repo/ui/StaleDataNotice";
import { Button } from "@repo/ui/Button";
import { cn } from "@repo/ui/cn";
import { useNow } from "@repo/classroom/join-window";
import { usePortal } from "../config";
import { clock, coins, dayLabel } from "../format";
import { TopUpDialog } from "../TopUpDialog";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Rise, Segmented, Skeleton, Stagger, ease } from "../primitives";

type Transaction = {
  id: string;
  type: string;
  /** Signed change to the spendable balance. */
  amount: number;
  description: string;
  createdAt: string;
};

type WalletData = { balance: number; heldBalance?: number; transactions: Transaction[] };

type Filter = "all" | "added" | "classes";

const TYPES: Record<string, { label: string; icon: React.ElementType; tone: string; group: Exclude<Filter, "all"> | "other" }> = {
  purchase: { label: "Top-up", icon: Plus, tone: "bg-trust/12 text-trust", group: "added" },
  bonus: { label: "Bonus", icon: Gift, tone: "bg-action/15 text-gold-strong", group: "added" },
  refund: { label: "Refund", icon: RotateCcw, tone: "bg-trust/12 text-trust", group: "classes" },
  hold: { label: "Held for a class", icon: Lock, tone: "bg-brand/10 text-brand", group: "classes" },
  hold_release: { label: "Hold released", icon: Unlock, tone: "bg-trust/12 text-trust", group: "classes" },
  spend: { label: "Class charged", icon: CalendarCheck2, tone: "bg-brand/10 text-brand", group: "classes" },
  adjustment: { label: "Adjustment", icon: SlidersHorizontal, tone: "bg-surface-inset text-text-muted", group: "other" },
};

export function WalletScreen() {
  const { fetch } = usePortal();
  const [topUp, setTopUp] = useState<{ open: boolean; choice?: string }>({ open: false });
  const [filter, setFilter] = useState<Filter>("all");

  // Balances are money, so the freshness window is short — but a revisit
  // paints the cached balance instead of a spinner.
  const { data, isLoading, isStale, updatedAt, refetch } = useJsonResource<WalletData>("/api/students/wallet", { staleMs: 10_000 });

  const transactions = useMemo(() => data?.transactions ?? [], [data]);
  const shown = useMemo(
    () => (filter === "all" ? transactions : transactions.filter((t) => (TYPES[t.type]?.group ?? "other") === filter)),
    [transactions, filter]
  );
  const now = useNow(60_000);
  const groups = useMemo(() => {
    const out: { label: string; items: Transaction[] }[] = [];
    for (const t of shown) {
      const label = dayLabel(new Date(t.createdAt), now);
      const last = out[out.length - 1];
      if (last?.label === label) last.items.push(t);
      else out.push({ label, items: [t] });
    }
    return out;
  }, [shown, now]);

  if (isLoading) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Loading wallet">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Skeleton className="h-[220px] rounded-xl" />
          <Skeleton className="h-[220px] rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }
  if (!data) return <ErrorState title="We couldn't load your wallet" onRetry={() => void refetch()} />;

  const held = data.heldBalance ?? 0;
  const open = (choice?: string) => setTopUp({ open: true, choice });

  return (
    <Stagger className="space-y-5 pb-10">
      {isStale && <StaleDataNotice onRetry={() => void refetch()} updatedAt={updatedAt} />}

      <Rise>
        <PageHeader
          title="Wallet"
          description="Coins pay for your classes. 1 coin = ₹1, and they never expire."
          actions={
            <Button variant="gold" onClick={() => open()}>
              <Plus className="h-4 w-4" /> Top up coins
            </Button>
          }
        />
      </Rise>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Balance */}
        <Rise>
          <section className="relative flex h-full flex-col overflow-hidden rounded-xl bg-navy p-6 text-cream shadow-level-2 dark:border dark:border-gold/15">
            <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl" aria-hidden />
            <div className="pointer-events-none absolute -bottom-28 left-10 h-56 w-56 rounded-full bg-accent/20 blur-3xl" aria-hidden />
            <div className="relative flex flex-1 flex-col">
              <p className="text-[12px] font-semibold text-cream/60">Available to spend</p>
              <p className="mt-2 flex items-baseline gap-2">
                <span className="text-[44px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{coins(data.balance)}</span>
                <span className="text-[15px] font-semibold text-cream/70">coins</span>
              </p>
              <p className="mb-6 mt-1.5 text-[12px] text-cream/50">Worth ₹{coins(data.balance)}</p>

              <dl className="mt-auto grid grid-cols-2 gap-4 border-t border-cream/10 pt-4">
                <div>
                  <dt className="flex items-center gap-1.5 text-[12px] text-cream/55">
                    <Lock className="h-3.5 w-3.5" /> Held for booked classes
                  </dt>
                  <dd className="mt-1 text-[18px] font-bold tabular-nums">{coins(held)}</dd>
                </div>
                <div>
                  <dt className="text-[12px] text-cream/55">Total in wallet</dt>
                  <dd className="mt-1 text-[18px] font-bold tabular-nums">{coins(data.balance + held)}</dd>
                </div>
              </dl>
            </div>
          </section>
        </Rise>

        {/* Quick top-up */}
        <Rise>
          <Panel className="flex h-full flex-col p-5">
            <h2 className="text-[14px] font-bold text-text">Quick top-up</h2>
            <p className="mt-0.5 text-[12px] text-text-subtle">Pick a pack to go straight to payment.</p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {COIN_PACKAGES.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => open(p.id)}
                  className={cn(
                    "group relative flex flex-col items-center rounded-xl border px-2 pb-3 pt-4 text-center transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-level-2 focus-ring motion-reduce:hover:translate-y-0",
                    i === 1 ? "border-action/60 bg-action-subtle" : "border-border bg-surface"
                  )}
                >
                  {i === 1 && (
                    <span className="absolute -top-2.5 rounded-full bg-action px-2 py-0.5 text-[10px] font-bold text-action-on">Most popular</span>
                  )}
                  <Coins className="mb-1.5 h-5 w-5 text-gold-strong" />
                  <span className="text-[17px] font-extrabold tabular-nums text-text">{coins(p.coins)}</span>
                  <span className="text-[11px] text-text-subtle">coins</span>
                  <span className="mt-2 text-[13px] font-semibold text-text-secondary">₹{coins(p.priceInr)}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => open("custom")}
              className="mt-2 rounded-xl border border-dashed border-border-strong py-2.5 text-[13px] font-semibold text-text-muted transition-colors hover:border-brand/50 hover:text-text focus-ring"
            >
              Choose your own amount
            </button>
            <p className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] text-text-subtle">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" /> UPI, cards and net banking through Cashfree
            </p>
          </Panel>
        </Rise>
      </div>

      {/* How it works */}
      <Rise>
        <Panel className="p-5">
          <h2 className="text-[14px] font-bold text-text">How paying for a class works</h2>
          <ol className="mt-4 grid gap-4 sm:grid-cols-3">
            {[
              { title: "Coins are held", body: "Booking holds the class price from your balance, so the time is guaranteed." },
              { title: "You pay for minutes taught", body: "After class you are charged only for the minutes you were actually taught." },
              { title: "The rest comes back", body: "Anything unused — or the whole hold if you cancel 12+ hours ahead — returns to your balance." },
            ].map((step, i) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand/10 text-[12px] font-bold text-brand">{i + 1}</span>
                <div>
                  <p className="text-[13px] font-semibold text-text">{step.title}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Panel>
      </Rise>

      {/* Activity */}
      <Rise>
        <Panel>
          <div className="flex flex-col gap-3 pr-5 sm:flex-row sm:items-center sm:justify-between">
            <PanelHeader title="Activity" meta={transactions.length ? `Your last ${transactions.length} transactions` : undefined} />
            <Segmented<Filter>
              label="Filter activity"
              value={filter}
              onChange={setFilter}
              className="ml-5 self-start sm:ml-0 sm:self-auto"
              options={[
                { value: "all", label: "All" },
                { value: "added", label: "Added" },
                { value: "classes", label: "Classes" },
              ]}
            />
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={filter} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15, ease }} className="px-2 pb-3">
              {shown.length === 0 ? (
                <EmptyState
                  icon={ReceiptText}
                  title={transactions.length ? "Nothing in this view" : "No activity yet"}
                  body={transactions.length ? "Try another filter." : "Top-ups, class holds and refunds will be listed here."}
                  action={
                    transactions.length ? undefined : (
                      <Button variant="gold" onClick={() => open()}>
                        Top up coins
                      </Button>
                    )
                  }
                />
              ) : (
                groups.map((g) => (
                  <div key={g.label} className="mt-2">
                    <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-text-subtle">{g.label}</p>
                    <ul>
                      {g.items.map((t) => (
                        <Row key={t.id} t={t} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </motion.div>
          </AnimatePresence>
        </Panel>
      </Rise>

      <TopUpDialog
        open={topUp.open}
        initialChoice={topUp.choice}
        onClose={() => setTopUp({ open: false })}
        onPaid={() => void refetch()}
        fetchImpl={fetch}
      />
    </Stagger>
  );
}

function Row({ t }: { t: Transaction }) {
  const meta = TYPES[t.type] ?? TYPES.adjustment!;
  const positive = t.amount > 0;
  return (
    <li className="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-surface-inset/60">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", meta.tone)}>
        <meta.icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-text">{t.description || meta.label}</p>
        <p className="text-[12px] text-text-subtle">
          {meta.label} · {clock(new Date(t.createdAt))}
        </p>
      </div>
      {t.amount === 0 ? (
        // A charge settles from held coins, so the spendable balance does not move.
        <span className="shrink-0 text-right text-[12px] text-text-subtle">From held coins</span>
      ) : (
        <span className={cn("inline-flex shrink-0 items-center gap-0.5 text-[14px] font-bold tabular-nums", positive ? "text-trust" : "text-text")}>
          {positive ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
          {positive ? "+" : "−"}
          {coins(Math.abs(t.amount))}
        </span>
      )}
    </li>
  );
}

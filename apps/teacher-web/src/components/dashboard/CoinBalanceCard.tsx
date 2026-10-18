import React from "react";
import Link from "next/link";
import { ArrowUpRight, Wallet } from "lucide-react";

interface CoinBalanceCardProps {
  balance: number;
  insufficientForNext?: boolean;
}

export function CoinBalanceCard({ balance, insufficientForNext = false }: CoinBalanceCardProps) {
  return (
    <article className="relative flex min-h-[168px] flex-col justify-between overflow-hidden rounded-xl border border-gold/30 bg-navy p-5 text-cream shadow-level-2 dark:border-gold/20">
      <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-gold/15 blur-3xl" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gold-soft">Coin balance</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cream/10 text-gold">
          <Wallet size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="relative mt-4">
        <p className="font-mono text-[30px] font-semibold leading-none tracking-[-0.04em]">{balance.toLocaleString("en-IN")}</p>
        <p className="mt-1.5 text-[11px] text-cream/55">1 coin = ₹1 · worth ₹{balance.toLocaleString("en-IN")}</p>
        {insufficientForNext && <p className="mt-2 text-[12px] font-semibold text-alert">Not enough coins for this class.</p>}
      </div>
      <Link
        href="/student/wallet"
        className="relative mt-4 inline-flex items-center gap-1 self-start rounded-lg bg-gold px-3 py-1.5 text-[12px] font-semibold text-navy transition-colors hover:bg-gold-soft auth-focus"
      >
        Top up coins <ArrowUpRight className="h-3.5 w-3.5" />
      </Link>
    </article>
  );
}

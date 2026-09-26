"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpRight, ArrowDownRight, ShieldCheck, AlertCircle, Coins, Clock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

export default function WalletPage() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch("/api/students/wallet", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load wallet data");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) {
          setBalance(data.balance);
          setTransactions(data.transactions);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="py-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full border border-border/50 shadow-sm bg-surface">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-alert/10 flex items-center justify-center mx-auto mb-4 border border-alert/20">
              <AlertCircle className="w-8 h-8 text-alert" />
            </div>
            <h2 className="text-[20px] font-display font-bold text-text mb-2 leading-tight">Unable to load wallet</h2>
            <p className="text-[14px] text-text-muted mb-6">{error}</p>
            <Button onClick={() => router.refresh()} variant="primary" className="shadow-sm">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            My Wallet
          </h1>
          <p className="text-base text-text-muted mt-1">
            Manage your coins and view transaction history
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT COLUMN ────────────────────────────── */}
        <div className="lg:col-span-1 space-y-4">
          {/* Balance Hero Card */}
          <Card className="bg-gradient-to-br from-[#231d5e] to-[#5046c8] text-white overflow-hidden relative border-none shadow-level-2">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[60px] pointer-events-none" />
            <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-gold/20 blur-[50px] pointer-events-none" />
            
            <CardHeader className="pb-2 pt-6">
              <CardTitle className="text-white/80 text-[12px] font-bold uppercase tracking-widest flex items-center gap-2">
                <Coins className="w-4 h-4 opacity-80" /> Current Balance
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="flex items-baseline gap-2 mb-6">
                <span className="font-display text-[48px] font-bold tabular-nums tracking-tight leading-none drop-shadow-sm">
                  {balance.toLocaleString()}
                </span>
                <span className="text-lg opacity-80" aria-hidden="true">🪙</span>
              </div>
              <Button className="w-full flex gap-2 h-11 text-[14px] shadow-sm font-bold bg-gold text-gold-950 hover:bg-[#d8b45e] transition-colors border-none">
                <Plus className="w-4 h-4" /> Top up Coins
              </Button>
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card className="border border-border bg-surface shadow-sm">
            <CardContent className="p-4 flex gap-3 items-start">
              <ShieldCheck className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div className="text-[13px] text-text-muted font-medium leading-relaxed">
                Coins never expire. <strong className="text-brand">1 Coin = ₹1</strong>. Payments are secured by Razorpay.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── TRANSACTION LEDGER ─────────────────────── */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col border border-border/50 shadow-sm">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-[18px] font-display font-bold text-text flex items-center gap-2">
                <Clock className="w-5 h-5 text-brand opacity-80" /> Transaction History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1">
              {transactions.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center h-full">
                  <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-4 border border-border/40">
                    <Coins className="w-8 h-8 text-brand opacity-40" />
                  </div>
                  <h3 className="text-[18px] font-bold text-text mb-2">No transactions yet</h3>
                  <p className="text-[14px] text-text-muted max-w-[280px]">
                    You haven't made any purchases or bookings. Top up to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => {
                    const isPositive = tx.amount > 0;
                    return (
                      <div key={tx.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-surface-inset/50 hover:bg-surface-inset border border-border/40 transition-colors">
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isPositive ? "bg-trust/10 text-trust" : "bg-text/5 text-text-muted"}`}>
                          {isPositive ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                        </div>
                        
                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[14px] text-text mb-0.5 truncate">
                            {tx.description}
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-text-muted">
                            <span className="uppercase font-semibold tracking-wider text-[10px] bg-surface border border-border/60 px-1.5 py-0.5 rounded text-text-subtle">
                              {tx.type}
                            </span>
                            <span>•</span>
                            <span>
                              {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                                month: "short", day: "numeric", year: "numeric",
                              })} at {new Date(tx.createdAt).toLocaleTimeString("en-IN", {
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Amount */}
                        <div className={`text-[16px] font-bold flex items-center gap-1 font-display tracking-tight ${isPositive ? "text-trust" : "text-text"}`}>
                          {isPositive ? "+" : ""}{tx.amount}
                          <span className="text-[12px] opacity-80" aria-hidden="true">🪙</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

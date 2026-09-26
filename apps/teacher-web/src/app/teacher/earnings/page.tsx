"use client";

import React, { useState, useEffect } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Banknote,
  Calendar,
  Coins,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";

type EarningsData = {
  summary: {
    totalEarnings: number;
    totalCommission: number;
    totalStudentPayments: number;
    totalClasses: number;
    thisMonth: { earnings: number; classes: number };
    thisWeek: { earnings: number; classes: number };
    today: { earnings: number; classes: number };
  };
  payouts: Array<{
    id: string;
    amount: number;
    status: string;
    periodStart: string;
    periodEnd: string;
    transactionRef: string | null;
    createdAt: string;
  }>;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: string;
  }>;
};

type WalletData = {
  balance: number;
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    description: string | null;
    createdAt: string;
  }>;
};

function formatCurrency(amount: number): string {
  return `₹${Math.round(amount / 100).toLocaleString("en-IN")}`;
}

const PAYOUT_STATUS: Record<string, { label: string; icon: typeof Clock; color: string; badge: "warning" | "info" | "success" | "danger" }> = {
  PENDING: { label: "Pending", icon: Clock, color: "text-warning", badge: "warning" },
  PROCESSING: { label: "Processing", icon: Clock, color: "text-brand", badge: "info" },
  PAID: { label: "Paid", icon: CheckCircle2, color: "text-trust", badge: "success" },
  FAILED: { label: "Failed", icon: XCircle, color: "text-danger", badge: "danger" },
};

export default function TeacherEarnings() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"earnings" | "wallet">("earnings");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [earningsRes, walletRes] = await Promise.all([
          fetch("/api/teachers/earnings", { credentials: "include" }),
          fetch("/api/teachers/wallet", { credentials: "include" }),
        ]);

        if (earningsRes.ok) setEarnings(await earningsRes.json());
        if (walletRes.ok) setWallet(await walletRes.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="py-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (error || !earnings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full border border-border/50 shadow-sm bg-surface">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-alert/10 flex items-center justify-center mx-auto mb-4 border border-alert/20">
              <AlertCircle className="w-8 h-8 text-alert" />
            </div>
            <h2 className="text-[20px] font-display font-bold text-text mb-2 leading-tight">Unable to load earnings</h2>
            <p className="text-[14px] text-text-muted">{error || "Failed to load data"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { summary, payouts } = earnings;
  const COMMISSION = 30;

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300 h-full flex flex-col">
      {/* ── HEADER ─────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-[32px] sm:text-[36px] font-display font-bold text-text tracking-[-0.02em] leading-tight">
            Earnings & Wallet
          </h1>
          <p className="text-base text-text-muted mt-1">
            Track your income and manage your coins
          </p>
        </div>
      </div>

      {/* ── TABS ───────────────────────────────────── */}
      <div className="flex overflow-x-auto no-scrollbar border-b" style={{ borderColor: "rgba(35,29,94,0.08)" }}>
        <button
          onClick={() => setActiveTab("earnings")}
          className={`px-5 py-3.5 font-semibold text-[14px] transition-all relative flex items-center gap-2 ${
            activeTab === "earnings" ? "text-brand" : "text-text-muted hover:text-text"
          }`}
        >
          <Banknote className="w-4 h-4" /> Earnings
          {activeTab === "earnings" && <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-brand" />}
        </button>
        <button
          onClick={() => setActiveTab("wallet")}
          className={`px-5 py-3.5 font-semibold text-[14px] transition-all relative flex items-center gap-2 ${
            activeTab === "wallet" ? "text-brand" : "text-text-muted hover:text-text"
          }`}
        >
          <Coins className="w-4 h-4" /> Coin Wallet
          {activeTab === "wallet" && <span className="absolute bottom-0 left-0 w-full h-[3px] rounded-t-full bg-brand" />}
        </button>
      </div>

      {/* ── CONTENT ────────────────────────────────── */}
      {activeTab === "earnings" ? (
        <div className="space-y-6">
          {/* Earnings Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Earnings */}
            <Card className="md:col-span-2 bg-gradient-to-br from-[#231d5e] to-[#5046c8] text-white border-none shadow-level-2 overflow-hidden relative">
              <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[60px] pointer-events-none" />
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-white/80 text-[12px] font-bold uppercase tracking-widest mb-3">
                  <Banknote className="w-4 h-4" /> Total Earnings
                </div>
                <div className="text-[48px] font-display font-bold tabular-nums tracking-tight leading-none mb-1">
                  {formatCurrency(summary.totalEarnings)}
                </div>
                <div className="text-[13px] text-white/80 font-medium">
                  {summary.totalClasses} classes · {COMMISSION}% platform fee
                </div>
                <div className="mt-6 pt-5 border-t border-white/20 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-[16px] font-bold">{formatCurrency(summary.today.earnings)}</div>
                    <div className="text-[11px] text-white/60 font-semibold uppercase mt-0.5">Today ({summary.today.classes})</div>
                  </div>
                  <div>
                    <div className="text-[16px] font-bold">{formatCurrency(summary.thisWeek.earnings)}</div>
                    <div className="text-[11px] text-white/60 font-semibold uppercase mt-0.5">Week ({summary.thisWeek.classes})</div>
                  </div>
                  <div>
                    <div className="text-[16px] font-bold">{formatCurrency(summary.thisMonth.earnings)}</div>
                    <div className="text-[11px] text-white/60 font-semibold uppercase mt-0.5">Month ({summary.thisMonth.classes})</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Platform Fee */}
            <Card className="border border-border/50 shadow-sm bg-alert/5 hover:border-alert/30 transition-colors">
              <CardContent className="p-5 flex flex-col justify-center h-full text-center">
                <div className="w-10 h-10 rounded-full bg-alert/10 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-5 h-5 text-alert" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-alert/80 mb-1">Platform Fee</div>
                <div className="text-[28px] font-display font-bold text-text leading-tight">{formatCurrency(summary.totalCommission)}</div>
                <div className="text-[12px] text-text-muted mt-2 font-medium bg-surface px-2 py-1 rounded-md mx-auto border border-border/50">
                  {COMMISSION}% commission
                </div>
              </CardContent>
            </Card>

            {/* Net after commission */}
            <Card className="border border-border/50 shadow-sm bg-trust/5 hover:border-trust/30 transition-colors">
              <CardContent className="p-5 flex flex-col justify-center h-full text-center">
                <div className="w-10 h-10 rounded-full bg-trust/10 flex items-center justify-center mx-auto mb-3">
                  <TrendingUp className="w-5 h-5 text-trust" />
                </div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-trust/80 mb-1">You Receive</div>
                <div className="text-[28px] font-display font-bold text-text leading-tight">{formatCurrency(summary.totalEarnings)}</div>
                <div className="text-[12px] text-text-muted mt-2 font-medium bg-surface px-2 py-1 rounded-md mx-auto border border-border/50">
                  Net earnings
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payout History */}
          <Card className="border border-border/50 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-[18px] font-display font-bold text-text flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand opacity-80" /> Payout History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {payouts.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center">
                  <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-4 border border-border/40">
                    <Banknote className="w-8 h-8 text-text-subtle" />
                  </div>
                  <h3 className="text-[18px] font-bold text-text mb-2">No payouts yet</h3>
                  <p className="text-[14px] text-text-muted">Payouts are processed automatically bi-weekly.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {payouts.map((payout) => {
                    const st = PAYOUT_STATUS[payout.status] || PAYOUT_STATUS.PENDING;
                    return (
                      <div key={payout.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-surface-inset/50 hover:bg-surface-inset border border-border/40 transition-colors">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm bg-surface ${st.color}`}>
                          <st.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-[16px] text-text mb-0.5 truncate font-display">
                            {formatCurrency(payout.amount)}
                          </div>
                          <div className="text-[12px] text-text-muted font-medium">
                            {new Date(payout.periodStart).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} –{" "}
                            {new Date(payout.periodEnd).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant={st.badge} className="text-[10px] uppercase font-bold tracking-wider py-0.5 px-2">
                            {st.label}
                          </Badge>
                          <div className="text-[11px] text-text-subtle font-medium">
                            {new Date(payout.createdAt).toLocaleDateString("en-IN")}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Coin Wallet */}
          {wallet && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Balance */}
                <Card className="bg-gradient-to-br from-gold to-gold-soft text-white border-none shadow-level-2">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-white/80 text-[12px] font-bold uppercase tracking-widest mb-3">
                      <Coins className="w-4 h-4" /> Coin Balance
                    </div>
                    <div className="flex items-baseline gap-2 mb-2">
                      <span className="font-display text-[48px] font-bold tabular-nums tracking-tight leading-none drop-shadow-sm">
                        {wallet.balance}
                      </span>
                      <span className="text-lg opacity-80" aria-hidden="true">🪙</span>
                    </div>
                    <div className="text-[13px] text-white/80 font-medium">Available coins for demos</div>
                  </CardContent>
                </Card>

                {/* How Coins Work */}
                <Card className="md:col-span-2 border border-border/50 shadow-sm bg-surface">
                  <CardHeader className="pb-2 border-b border-border/40">
                    <CardTitle className="text-[16px] font-bold text-text">How Coins Work</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4 text-[13px] text-text-muted space-y-3">
                    <p className="font-medium text-text">Coins are used on the platform for:</p>
                    <ul className="space-y-2">
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />
                        <span><strong className="text-text">Demo Classes</strong> — Students use coins to book trial slots with you.</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-gold mt-1.5 shrink-0" />
                        <span><strong className="text-text">Student Outreach</strong> — You can use coins to message prospective students.</span>
                      </li>
                    </ul>
                    <div className="bg-surface-inset px-3 py-2 rounded-lg mt-4 border border-border/40 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-brand" />
                      <span className="text-[12px] font-medium">Standard class payments are processed in fiat currency via bank transfer.</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions */}
              <Card className="border border-border/50 shadow-sm">
                <CardHeader className="pb-4 border-b border-border/40">
                  <CardTitle className="text-[18px] font-display font-bold text-text flex items-center gap-2">
                    <Clock className="w-5 h-5 text-brand opacity-80" /> Coin Transactions
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {wallet.transactions.length === 0 ? (
                    <div className="py-16 flex flex-col items-center justify-center text-center">
                      <div className="w-16 h-16 rounded-2xl bg-surface-inset flex items-center justify-center mx-auto mb-4 border border-border/40">
                        <Coins className="w-8 h-8 text-text-subtle" />
                      </div>
                      <h3 className="text-[18px] font-bold text-text mb-2">No transactions yet</h3>
                      <p className="text-[14px] text-text-muted">Coin activity will appear here.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wallet.transactions.map((tx) => {
                        const isPositive = tx.amount > 0;
                        return (
                          <div key={tx.id} className="flex items-center gap-4 p-3.5 rounded-xl bg-surface-inset/50 hover:bg-surface-inset border border-border/40 transition-colors">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${isPositive ? "bg-trust/10 text-trust" : "bg-text/5 text-text-muted"}`}>
                              {isPositive ? <ArrowDownRight className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-[14px] text-text mb-0.5 truncate">
                                {tx.description || tx.type}
                              </div>
                              <div className="text-[12px] text-text-muted font-medium">
                                {new Date(tx.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })} at{" "}
                                {new Date(tx.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            
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
            </>
          )}
        </div>
      )}
    </div>
  );
}

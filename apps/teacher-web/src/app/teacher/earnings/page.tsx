"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  AlertCircle,
  Loader2,
  TrendingUp,
  CreditCard,
  Banknote,
  Calendar,
  Coins,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

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

const PAYOUT_STATUS: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  PENDING: { label: "Pending", icon: Clock, color: "text-warning" },
  PROCESSING: { label: "Processing", icon: Loader2, color: "text-brand" },
  PAID: { label: "Paid", icon: CheckCircle2, color: "text-trust" },
  FAILED: { label: "Failed", icon: XCircle, color: "text-danger" },
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
          <span className="text-sm text-text-muted">Loading earnings…</span>
        </div>
      </div>
    );
  }

  if (error || !earnings) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <AlertCircle className="w-10 h-10 text-danger mx-auto mb-3" />
          <p className="text-text-muted">{error || "Failed to load earnings"}</p>
        </div>
      </div>
    );
  }

  const { summary, payouts, transactions } = earnings;
  const COMMISSION = 30;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-text">Earnings & Wallet</h1>
          <p className="text-text-muted mt-1">Track your income and manage your coins</p>
        </div>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-1 bg-surface-inset p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab("earnings")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "earnings"
              ? "bg-surface text-text shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Banknote className="w-4 h-4 inline mr-1.5" /> Earnings
        </button>
        <button
          onClick={() => setActiveTab("wallet")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "wallet"
              ? "bg-surface text-text shadow-sm"
              : "text-text-muted hover:text-text"
          }`}
        >
          <Coins className="w-4 h-4 inline mr-1.5" /> Coin Wallet
        </button>
      </div>

      {activeTab === "earnings" ? (
        <>
          {/* Earnings Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Total Earnings */}
            <Card className="md:col-span-2 bg-gradient-to-br from-brand to-brand-hover text-white border-none">
              <CardContent className="p-6">
                <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-2">
                  <Banknote className="w-4 h-4" /> Total Earnings
                </div>
                <div className="text-4xl font-bold">{formatCurrency(summary.totalEarnings)}</div>
                <div className="text-sm text-white/60 mt-2">
                  {summary.totalClasses} classes · {COMMISSION}% platform fee
                </div>
                <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-sm font-semibold">{formatCurrency(summary.today.earnings)}</div>
                    <div className="text-[11px] text-white/60">Today ({summary.today.classes})</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{formatCurrency(summary.thisWeek.earnings)}</div>
                    <div className="text-[11px] text-white/60">This Week ({summary.thisWeek.classes})</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{formatCurrency(summary.thisMonth.earnings)}</div>
                    <div className="text-[11px] text-white/60">This Month ({summary.thisMonth.classes})</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Commission Paid */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-text-muted text-sm font-medium mb-3">
                  <CreditCard className="w-4 h-4 text-danger" /> Platform Fee
                </div>
                <div className="text-2xl font-bold text-text">{formatCurrency(summary.totalCommission)}</div>
                <div className="text-xs text-text-muted mt-1">
                  {COMMISSION}% commission deducted
                </div>
              </CardContent>
            </Card>

            {/* Net after commission */}
            <Card>
              <CardContent className="p-5">
                <div className="flex items-center gap-2 text-text-muted text-sm font-medium mb-3">
                  <TrendingUp className="w-4 h-4 text-trust" /> You Receive
                </div>
                <div className="text-2xl font-bold text-trust">{formatCurrency(summary.totalEarnings)}</div>
                <div className="text-xs text-text-muted mt-1">
                  Transferred to bank
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Payout History */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="w-5 h-5 text-brand" /> Payout History
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payouts.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="w-10 h-10 text-text-subtle mx-auto mb-3" />
                  <p className="text-sm text-text-muted">No payouts yet. Payouts are processed bi-weekly.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {payouts.map((payout) => {
                    const st = PAYOUT_STATUS[payout.status] || PAYOUT_STATUS.PENDING;
                    return (
                      <div key={payout.id} className="flex items-center gap-4 p-4 rounded-xl bg-surface-inset border border-border">
                        <div className={`p-2 rounded-full bg-surface ${st.color}`}>
                          <st.icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-text">
                            {formatCurrency(payout.amount)}
                          </div>
                          <div className="text-xs text-text-muted">
                            {new Date(payout.periodStart).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} –{" "}
                            {new Date(payout.periodEnd).toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                          </div>
                        </div>
                        <Badge
                          variant={
                            payout.status === "PAID"
                              ? "success"
                              : payout.status === "FAILED"
                              ? "danger"
                              : payout.status === "PROCESSING"
                              ? "info"
                              : "warning"
                          }
                        >
                          {st.label}
                        </Badge>
                        <div className="text-xs text-text-muted">
                          {new Date(payout.createdAt).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <>
          {/* Coin Wallet */}
          {wallet && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Balance */}
                <Card className="bg-gradient-to-br from-gold to-gold-soft text-white border-none">
                  <CardContent className="p-6">
                    <div className="flex items-center gap-2 text-white/80 text-sm font-medium mb-2">
                      <Coins className="w-4 h-4" /> Coin Balance
                    </div>
                    <div className="text-4xl font-bold">{wallet.balance}</div>
                    <div className="text-sm text-white/60 mt-2">Available coins</div>
                  </CardContent>
                </Card>

                {/* How Coins Work */}
                <Card className="md:col-span-2">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">How Coins Work</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-text-muted space-y-2">
                    <p>Coins are used for:</p>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><strong className="text-text">Demo Classes</strong> — Book demo slots with students</li>
                      <li><strong className="text-text">Student Outreach</strong> — Proactively message prospective students</li>
                    </ul>
                    <p className="text-xs border-t border-border pt-2 mt-2 text-text-subtle">
                      Standard class payments are processed in fiat currency via bank transfer.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Transactions */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Coin Transactions</CardTitle>
                </CardHeader>
                <CardContent>
                  {wallet.transactions.length === 0 ? (
                    <div className="text-center py-8">
                      <Coins className="w-10 h-10 text-text-subtle mx-auto mb-3" />
                      <p className="text-sm text-text-muted">No transactions yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {wallet.transactions.map((tx) => {
                        const isPositive = tx.amount > 0;
                        return (
                          <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl bg-surface-inset border border-border">
                            <div className={`p-2 rounded-full ${isPositive ? "bg-trust/10 text-trust" : "bg-danger/10 text-danger"}`}>
                              {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-text truncate">
                                {tx.description || tx.type}
                              </div>
                              <div className="text-xs text-text-muted">
                                {new Date(tx.createdAt).toLocaleDateString("en-IN")} at{" "}
                                {new Date(tx.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </div>
                            <div className={`text-base font-bold ${isPositive ? "text-trust" : "text-text"}`}>
                              {isPositive ? "+" : ""}{tx.amount}
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
        </>
      )}
    </div>
  );
}

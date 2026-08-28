"use client";

import React, { useState, useEffect } from "react";
import { Plus, ArrowUpRight, ArrowDownRight, ShieldCheck, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";

type Transaction = {
  id: string;
  type: string;
  amount: number;
  description: string;
  createdAt: string;
};

export default function WalletPage() {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const res = await fetch("/api/students/wallet", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load wallet data");
      const data = await res.json();
      setBalance(data.balance);
      setTransactions(data.transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-brand/20 border-t-brand animate-spin" />
            <div className="absolute inset-0 w-12 h-12 rounded-full border-[3px] border-transparent border-t-gold animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <span className="text-sm text-text-muted font-medium">Loading wallet...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-danger/10 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-danger" />
            </div>
            <h2 className="text-xl font-display font-bold text-text mb-2">Unable to load wallet</h2>
            <p className="text-text-muted mb-6">{error}</p>
            <Button onClick={() => window.location.reload()} variant="primary">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand mb-2">My Wallet</h1>
        <p className="text-text-muted">Manage your coins and view transaction history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Balance Hero Card */}
        <div className="lg:col-span-1">
          <Card className="bg-gradient-to-br from-[#0f0c29] via-[#1a1547] to-[#231d5e] text-white overflow-hidden relative border-none shadow-lg rounded-2xl">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-amber-400/10 blur-[60px] pointer-events-none" />
            <CardHeader className="pb-2">
              <CardTitle className="text-white/60 text-sm font-medium uppercase tracking-wider">Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-2xl" aria-hidden="true">🪙</span>
                <span className="font-display text-5xl font-bold tabular-nums tracking-tight">{balance.toLocaleString()}</span>
              </div>
              <Button variant="gold" className="w-full flex gap-2">
                <Plus className="w-4 h-4" /> Top up Coins
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6 border-brand/20 bg-brand/5 rounded-2xl">
            <CardContent className="p-4 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-brand shrink-0 mt-0.5" />
              <div className="text-sm text-text-muted">
                Coins never expire. 1 Coin = ₹1. Payments are secured by Razorpay.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Ledger */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col rounded-2xl">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-text">Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
              {transactions.length === 0 ? (
                <div className="py-14 text-center">
                  <div className="w-12 h-12 rounded-xl bg-surface-inset flex items-center justify-center mx-auto mb-3">
                    <Plus className="w-5 h-5 text-text-subtle" />
                  </div>
                  <p className="text-sm font-bold text-text">No transactions found</p>
                  <p className="text-xs text-text-muted mt-1">You haven&apos;t made any purchases or bookings yet.</p>
                  <Button variant="primary" size="sm" className="mt-4">
                    Top up Coins
                  </Button>
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-surface-inset text-text-muted uppercase text-xs">
                    <tr>
                      <th className="px-6 py-4 font-semibold">Transaction</th>
                      <th className="px-6 py-4 font-semibold">Date</th>
                      <th className="px-6 py-4 font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-surface-inset/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-text mb-1">{tx.description}</div>
                          <div className="flex gap-2 items-center text-xs text-text-muted">
                            <span className="uppercase">{tx.type}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                          {new Date(tx.createdAt).toLocaleDateString("en-IN", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div
                            className={`flex items-center gap-1 font-semibold ${
                              tx.amount > 0 ? "text-trust" : "text-text"
                            }`}
                          >
                            {tx.amount > 0 ? (
                              <ArrowUpRight className="w-4 h-4" />
                            ) : (
                              <ArrowDownRight className="w-4 h-4" />
                            )}
                            {Math.abs(tx.amount)}{" "}
                            <span className="text-xs" aria-hidden="true">🪙</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

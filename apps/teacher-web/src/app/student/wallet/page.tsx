"use client";

import React from "react";
import { Plus, ArrowUpRight, ArrowDownRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";


// Mock Ledger Data
const transactions = [
  { id: "tx_1", type: "purchase", amount: 1050, date: "2026-08-15 14:30", ref: "Razorpay order_xyz", desc: "Bought 1000 Coins + 50 Bonus" },
  { id: "tx_2", type: "debit", amount: -49, date: "2026-08-16 09:15", ref: "Booking #bk_123", desc: "Demo Class with Elena R." },
  { id: "tx_3", type: "debit", amount: -150, date: "2026-08-17 11:00", ref: "Booking #bk_124", desc: "1h Class with Elena R." },
  { id: "tx_4", type: "refund", amount: 150, date: "2026-08-17 11:45", ref: "Cancel #bk_124", desc: "Auto-refund (Teacher cancelled)" },
];

export default function WalletPage() {
  return (
    <div className="flex flex-col h-full gap-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-brand mb-2">My Wallet</h1>
        <p className="text-text-muted">Manage your coins and view transaction history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Balance Hero Card */}
        <div className="lg:col-span-1">
          <Card className="bg-brand text-brand-on overflow-hidden relative border-none shadow-glow-gold rounded-md">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-white/10 blur-[60px] pointer-events-none" />
            <CardHeader className="pb-2">
              <CardTitle className="text-white/80 text-sm font-medium uppercase tracking-wider">Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-gold text-4xl" aria-hidden="true">🪙</span>
                <span className="font-display text-6xl font-bold tabular-nums tracking-tight">1,001</span>
              </div>
              <Button variant="gold" className="w-full flex gap-2">
                <Plus className="w-4 h-4" /> Top up Coins
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6 border-brand/20 bg-brand-subtle/10 rounded-md">
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
          <Card className="h-full flex flex-col rounded-md border border-border">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-brand">Transaction History</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-x-auto">
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
                        <div className="font-medium text-text mb-1">{tx.desc}</div>
                        <div className="flex gap-2 items-center text-xs text-text-muted">
                          <span className="uppercase">{tx.type}</span> • {tx.ref}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-text-muted whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`flex items-center gap-1 font-semibold ${
                          tx.type === 'purchase' || tx.type === 'refund' ? 'text-trust' : 'text-text'
                        }`}>
                          {tx.type === 'purchase' || tx.type === 'refund' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {Math.abs(tx.amount)} <span className="text-gold text-xs" aria-hidden="true">🪙</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {transactions.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-14 text-center">
                        <div className="flex flex-col items-center justify-center max-w-sm mx-auto space-y-3">
                          <div className="w-12 h-12 rounded-xl bg-brand-subtle flex items-center justify-center text-brand">
                            <Plus className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-brand">No transactions found</p>
                            <p className="text-xs text-text-muted mt-1">You haven&apos;t made any purchases or bookings yet.</p>
                          </div>
                          <Button variant="gold" size="sm">
                            Top up Coins
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

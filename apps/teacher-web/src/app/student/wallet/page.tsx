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
        <h1 className="font-display text-3xl font-bold text-text mb-2">My Wallet</h1>
        <p className="text-text-muted">Manage your coins and view transaction history.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Balance Hero Card */}
        <div className="lg:col-span-1">
          <Card className="bg-navy text-white overflow-hidden relative border-none shadow-glow-gold">
            <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gold/20 blur-[60px] pointer-events-none" />
            <CardHeader className="pb-2">
              <CardTitle className="text-cream/80 text-sm font-medium uppercase tracking-wider">Current Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2 mb-8">
                <span className="text-gold text-4xl">🪙</span>
                <span className="font-display text-6xl font-bold tabular-nums tracking-tight">1,001</span>
              </div>
              <Button variant="gold" className="w-full flex gap-2 shadow-glow-gold">
                <Plus className="w-4 h-4" /> Top up Coins
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6 border-gold/20 bg-gold/5">
            <CardContent className="p-4 flex gap-3">
              <ShieldCheck className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div className="text-sm text-text-muted">
                Coins never expire. 1 Coin = ₹1. Payments are secured by Razorpay.
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaction Ledger */}
        <div className="lg:col-span-2">
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle>Transaction History</CardTitle>
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
                          tx.type === 'purchase' || tx.type === 'refund' ? 'text-success' : 'text-text'
                        }`}>
                          {tx.type === 'purchase' || tx.type === 'refund' ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                          {Math.abs(tx.amount)} <span className="text-gold text-xs">🪙</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

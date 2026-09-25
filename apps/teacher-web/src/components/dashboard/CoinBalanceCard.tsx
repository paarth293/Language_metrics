import React from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";

interface CoinBalanceCardProps {
  balance: number;
  insufficientForNext?: boolean;
}

export function CoinBalanceCard({ balance, insufficientForNext = false }: CoinBalanceCardProps) {
  return (
    <Card className="flex-none hover:shadow-level-2 transition-shadow duration-180">
      <CardContent className="p-5 sm:p-6 flex flex-col justify-center h-full">
        <div className="flex justify-between items-start mb-2">
          <div className="text-[11px] font-semibold text-text-subtle uppercase tracking-[0.12em]">
            Coin Balance
          </div>
          <Link href="/student/wallet" className="text-sm font-medium text-action hover:text-action-hover auth-focus rounded px-1 -mx-1 transition-colors">
            Top up
          </Link>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-[26px] font-display font-bold text-text tracking-[-0.01em]">
            {balance}
          </div>
          <div className="text-xs text-text-subtle">
            ≈ ₹{balance.toLocaleString()}
          </div>
        </div>
        {insufficientForNext && (
          <div className="text-[11px] text-alert mt-2 font-medium">
            Not enough coins for this class.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

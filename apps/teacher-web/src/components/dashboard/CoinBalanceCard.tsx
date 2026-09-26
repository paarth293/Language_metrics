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
      <CardContent className="p-5 flex flex-col justify-center h-full">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-display font-semibold text-base text-text tracking-[-0.01em]">
            Coin balance
          </h3>
          <Link href="/student/wallet" className="text-sm font-medium text-action hover:text-action-hover auth-focus rounded-md inline-flex min-h-11 items-center -my-3 px-2 -mx-2 transition-colors">
            Top up
          </Link>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="font-display text-[20px] sm:text-[28px] font-bold leading-none tracking-[-0.01em] text-text">
            {balance}
          </div>
          <div className="text-xs text-text-subtle">
            ≈ ₹{balance.toLocaleString()}
          </div>
        </div>
        {insufficientForNext && (
          <div className="text-xs text-alert mt-2 font-medium">
            Not enough coins for this class.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

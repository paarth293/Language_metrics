import React from "react";
import { Card, CardContent } from "@/components/ui/Card";

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-[28px] animate-pulse">
      {/* Zone A: Greeting */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="h-10 w-64 bg-surface-inset rounded-lg mb-3" />
          <div className="h-5 w-48 bg-surface-inset rounded-lg" />
        </div>
        <div className="hidden sm:block h-6 w-32 bg-surface-inset rounded-full" />
      </div>

      {/* Zone B: Hero */}
      <div className="flex flex-col lg:flex-row gap-6 h-auto lg:h-[320px]">
        <div className="flex flex-col w-full lg:w-1/3 h-[320px] lg:h-full gap-6">
          <Card className="flex-1 shadow-none border-none bg-surface">
            <CardContent className="h-full bg-surface-inset/50" />
          </Card>
          <Card className="flex-none h-[110px] shadow-none border-none bg-surface">
            <CardContent className="h-full bg-surface-inset/50" />
          </Card>
        </div>
        <Card className="flex-1 shadow-none border-none bg-surface h-[320px] lg:h-full">
          <CardContent className="h-full bg-surface-inset/50" />
        </Card>
      </div>

      {/* Zone C: Metric rail */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="shadow-none border-none bg-surface h-[110px]">
            <CardContent className="h-full bg-surface-inset/50" />
          </Card>
        ))}
      </div>
    </div>
  );
}

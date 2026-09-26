import React from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    trend: "up" | "down";
  };
  icon: React.ElementType;
  accentColor?: string;
  accentBg?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  accentColor = "#c7982f",
  accentBg = "rgba(199,152,47,0.1)",
}: MetricCardProps) {
  return (
    <Card className="relative overflow-hidden hover:shadow-level-2 transition-shadow duration-180">
      {/* Colored accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
      />

      <CardContent className="p-5 flex flex-col gap-4">
        {/* Icon + Delta row */}
        <div className="flex items-center justify-between">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: accentBg }}
          >
            <Icon className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          {delta && (
            <div
              className={cn(
                "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                delta.trend === "up" ? "bg-trust/10 text-trust" : "bg-alert/10 text-alert"
              )}
            >
              {delta.trend === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
              {delta.value}
            </div>
          )}
        </div>

        {/* Value + Label */}
        <div>
          <div className="font-display text-[20px] sm:text-[28px] font-bold leading-none tracking-[-0.01em] text-text mb-1">
            {value}
          </div>
          <div className="text-xs font-medium text-text-subtle">
            {label}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

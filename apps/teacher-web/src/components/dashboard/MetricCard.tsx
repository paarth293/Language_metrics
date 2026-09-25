import React from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, ArrowDown } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  delta?: {
    value: number;
    trend: "up" | "down";
  };
  icon: React.ElementType;
  highlight?: boolean;
  accentColor?: string;
  accentBg?: string;
}

export function MetricCard({
  label,
  value,
  delta,
  icon: Icon,
  highlight,
  accentColor = "#c7982f",
  accentBg = "rgba(199,152,47,0.1)",
}: MetricCardProps) {
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 group"
      style={{
        background: "#ffffff",
        border: "1px solid rgba(35,29,94,0.08)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -8px rgba(35,29,94,0.08)",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 24px -4px rgba(35,29,94,0.14)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.boxShadow = "0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -8px rgba(35,29,94,0.08)";
        (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
      }}
    >
      {/* Colored accent bar at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[3px] rounded-t-2xl"
        style={{ background: `linear-gradient(90deg, ${accentColor}, ${accentColor}88)` }}
      />

      {/* Icon + Delta row */}
      <div className="flex items-center justify-between pt-1">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: accentBg }}
        >
          <Icon className="w-5 h-5" style={{ color: accentColor }} />
        </div>
        {delta && (
          <div
            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full"
            style={{
              background: delta.trend === "up" ? "rgba(15,157,107,0.1)" : "rgba(220,76,62,0.1)",
              color: delta.trend === "up" ? "#0f9d6b" : "#dc4c3e",
            }}
          >
            {delta.trend === "up" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {delta.value}
          </div>
        )}
      </div>

      {/* Value + Label */}
      <div>
        <div
          className="text-[30px] font-bold leading-none tracking-tight mb-1"
          style={{ color: "#1a1547", fontFamily: "var(--font-fraunces, serif)" }}
        >
          {value}
        </div>
        <div className="text-[12px] font-medium" style={{ color: "#8a93a6" }}>
          {label}
        </div>
      </div>
    </div>
  );
}

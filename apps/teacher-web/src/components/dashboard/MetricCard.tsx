import React from "react";
import { cn } from "@/lib/cn";
import { ArrowUp, ArrowDown } from "lucide-react";

export interface MetricCardProps {
  label: string;
  value: string | number;
  /** Small caption under the value, as on the admin panel's metric cards. */
  helper?: string;
  delta?: {
    value: number;
    trend: "up" | "down";
  };
  /** A short status chip instead of a numeric delta (e.g. "3 to review"). */
  tag?: string;
  icon: React.ElementType;
  accentColor?: string;
  accentBg?: string;
  /** Navy card for the one metric that matters most. */
  highlight?: boolean;
}

export function MetricCard({
  label,
  value,
  helper,
  delta,
  tag,
  icon: Icon,
  accentColor = "var(--color-action)",
  accentBg = "var(--color-action-subtle)",
  highlight,
}: MetricCardProps) {
  return (
    <article
      className={cn(
        "flex min-h-[112px] flex-col justify-between rounded-xl border p-5 shadow-level-1",
        highlight ? "border-gold/30 bg-navy text-cream" : "border-border bg-surface"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "text-[10px] font-bold uppercase leading-tight tracking-[0.16em]",
            highlight ? "text-gold-soft" : "text-text-subtle"
          )}
        >
          {label}
        </p>
        <span
          className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", highlight && "bg-cream/10 text-gold")}
          style={highlight ? undefined : { backgroundColor: accentBg, color: accentColor }}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={cn("font-mono text-[24px] font-semibold leading-none tracking-[-0.04em]", highlight ? "text-cream" : "text-text")}>
            {value}
          </p>
          {helper && (
            <p className={cn("mt-1.5 truncate text-[10px]", highlight ? "text-cream/55" : "text-text-subtle")}>{helper}</p>
          )}
        </div>
        {delta ? (
          <span
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold",
              delta.trend === "up" ? "bg-trust/10 text-trust" : "bg-alert/10 text-alert"
            )}
          >
            {delta.trend === "up" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {delta.value}
          </span>
        ) : tag ? (
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
              highlight ? "bg-cream/10 text-gold" : "bg-surface-inset text-text-muted"
            )}
          >
            {tag}
          </span>
        ) : null}
      </div>
    </article>
  );
}

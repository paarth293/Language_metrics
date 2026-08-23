import { CalendarDays, ClipboardCheck, TrendingUp, UsersRound } from "lucide-react";
import type { DashboardMetric, MetricIcon } from "./types";
import clsx from "clsx";

const metricIcons: Record<MetricIcon, typeof TrendingUp> = {
  revenue: TrendingUp,
  teachers: UsersRound,
  approvals: ClipboardCheck,
  classes: CalendarDays,
};

export function MetricCard({ metric }: { metric: DashboardMetric; index: number }) {
  const Icon = metricIcons[metric.icon];

  return (
    <article
      className={clsx(
        "lm-panel flex min-h-[112px] flex-col justify-between p-5",
        metric.tone === "teal" && "border-[var(--brand-gold)]/30 bg-[var(--brand-navy)] text-white"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={clsx(
            "lm-kicker",
            metric.tone === "teal" ? "text-[var(--brand-gold-pale)]" : ""
          )}
        >
          {metric.label}
        </p>
        <span
          className={clsx(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
            metric.tone === "teal" && "bg-white/10 text-[var(--brand-gold)]",
            metric.tone === "amber" && "bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]",
            metric.tone === "default" && "bg-[var(--surface-2)] text-[var(--text-muted)]"
          )}
        >
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p
            className={clsx(
              "lm-mono text-[24px] font-semibold tracking-[-0.04em]",
              metric.tone === "teal" ? "text-white" : "text-[var(--text)]"
            )}
          >
            {metric.value}
          </p>
          <p
            className={clsx(
              "mt-1 truncate text-[10px]",
              metric.tone === "teal" ? "text-white/50" : "text-[var(--text-subtle)]"
            )}
          >
            {metric.helper}
          </p>
        </div>
        {metric.delta ? (
          <span
            className={clsx(
              "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
              metric.tone === "amber"
                ? "bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]"
                : metric.tone === "teal"
                ? "bg-white/10 text-[var(--brand-gold)]"
                : "bg-[var(--surface-2)] text-[var(--text-muted)]"
            )}
          >
            {metric.delta}
          </span>
        ) : null}
      </div>
    </article>
  );
}

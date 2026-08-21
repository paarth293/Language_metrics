"use client";

import { motion } from "framer-motion";
import { CalendarDays, ClipboardCheck, TrendingUp, UsersRound } from "lucide-react";
import type { DashboardMetric, MetricIcon } from "./types";
import clsx from "clsx";

const metricIcons: Record<MetricIcon, typeof TrendingUp> = {
  revenue: TrendingUp,
  teachers: UsersRound,
  approvals: ClipboardCheck,
  classes: CalendarDays,
};

export function MetricCard({ metric, index }: { metric: DashboardMetric; index: number }) {
  const Icon = metricIcons[metric.icon];

  return (
    <motion.article
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: index * 0.045, ease: "easeOut" }}
      className={clsx(
        "lm-panel flex min-h-[122px] flex-col justify-between p-5",
        metric.tone === "amber" && "border-[#eadbc2] bg-[#fffaf1] dark:border-[#64513a] dark:bg-[#2b251b]",
        metric.tone === "teal" && "border-[var(--lm-teal)] bg-[var(--lm-slate-900)] text-[#ffffff] shadow-[0_12px_28px_rgba(29,118,111,0.14)]"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={clsx("lm-kicker", metric.tone === "teal" && "text-[#a9dfd6]")}>{metric.label}</p>
        <span className={clsx(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
          metric.tone === "teal" && "bg-[#2d5a5b] text-[#a9dfd6]",
          metric.tone === "amber" && "bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]",
          metric.tone === "default" && "bg-[var(--lm-surface-2)] text-[var(--lm-muted)]"
        )}>
          <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
        </span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className={clsx("lm-mono text-[25px] font-semibold tracking-[-0.06em]", metric.tone === "teal" ? "text-[#ffffff]" : "text-[var(--lm-ink-strong)]")}>
            {metric.value}
          </p>
          <p className={clsx("mt-1 truncate text-[10px]", metric.tone === "teal" ? "text-[#a9c4c2]" : "text-[var(--lm-subtle)]")}>
            {metric.helper}
          </p>
        </div>
        {metric.delta ? (
          <span className={clsx(
            "shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold",
            metric.tone === "amber" ? "bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]" : "bg-[var(--lm-teal-soft)] text-[var(--lm-teal-deep)]"
          )}>
            {metric.delta}
          </span>
        ) : null}
      </div>
    </motion.article>
  );
}

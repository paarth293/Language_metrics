import Link from "next/link";
import { ArrowRight, Banknote, MessageSquareWarning, UsersRound } from "lucide-react";
import clsx from "clsx";
import type { QueueItem } from "./types";

export function ActionQueue({ items }: { items: QueueItem[] }) {
  return (
    <section className="lm-panel p-6" aria-labelledby="action-queue-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="lm-kicker">Action queue</p>
          <h2 id="action-queue-title" className="mt-2 text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Needs your attention</h2>
          <p className="mt-1 text-[11px] text-[var(--lm-muted)]">Small tasks keeping the platform moving.</p>
        </div>
        <span className="lm-status lm-status--slate">{items.length} open</span>
      </div>

      <div className="mt-5 space-y-2.5">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="group flex min-h-[64px] items-center gap-3 rounded-xl border border-[var(--lm-line)] bg-[var(--lm-paper-muted)] px-3.5 transition-all hover:-translate-y-0.5 hover:border-[var(--lm-line-strong)] hover:bg-[var(--lm-hover)]">
              <span className={clsx(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px]",
                item.tone === "teal" && "bg-[var(--lm-teal-soft)] text-[var(--lm-teal-deep)]",
                item.tone === "amber" && "bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]",
                item.tone === "red" && "bg-[var(--lm-red-soft)] text-[var(--lm-red)]"
              )}>
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold text-[var(--lm-ink)]">{item.label}</span>
                <span className="mt-1 block truncate text-[10px] text-[var(--lm-subtle)]">{item.detail}</span>
              </span>
              <span className="lm-mono text-[11px] font-semibold text-[var(--lm-muted)]">{item.value}</span>
              <ArrowRight size={15} className="text-[var(--lm-subtle)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--lm-teal)]" aria-hidden="true" />
            </Link>
          );
        })}
      </div>

      <Link href="/complaints" className="mt-4 flex min-h-10 items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--lm-line-strong)] text-[11px] font-bold text-[var(--lm-teal-deep)] transition-colors hover:bg-[var(--lm-teal-wash)]">
        Open operations queue <ArrowRight size={13} aria-hidden="true" />
      </Link>
    </section>
  );
}

export const actionQueueIcons = {
  approvals: UsersRound,
  complaints: MessageSquareWarning,
  payouts: Banknote,
};

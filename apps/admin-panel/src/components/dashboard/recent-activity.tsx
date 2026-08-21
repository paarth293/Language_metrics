import { Activity, ArrowUpRight, Database, Inbox } from "lucide-react";

export interface ActivityItem {
  id: string;
  title: string;
  detail: string;
  category: string;
  tone: "teal" | "blue" | "amber";
}

export function RecentActivity({ items }: { items: ActivityItem[] }) {
  return (
    <section className="lm-panel p-6" aria-labelledby="recent-activity-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="lm-kicker">Recent activity</p>
          <h2 id="recent-activity-title" className="mt-2 text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">What changed today</h2>
          <p className="mt-1 text-[11px] text-[var(--lm-muted)]">The latest signals across your workspace.</p>
        </div>
        <a href="/audit-logs" className="hidden items-center gap-1 text-[10px] font-bold text-[var(--lm-teal-deep)] sm:flex">Open audit log <ArrowUpRight size={12} aria-hidden="true" /></a>
      </div>

      <div className="mt-5 divide-y divide-[var(--lm-line)]">
        {items.length ? items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
            <span className={item.tone === "teal" ? "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lm-teal-soft)] text-[var(--lm-teal-deep)]" : item.tone === "amber" ? "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lm-amber-soft)] text-[var(--lm-amber)]" : "flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lm-blue-soft)] text-[var(--lm-blue)]"}>
              {item.tone === "teal" ? <Activity size={15} aria-hidden="true" /> : item.tone === "amber" ? <Inbox size={15} aria-hidden="true" /> : <Database size={15} aria-hidden="true" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-[var(--lm-ink)]">{item.title}</p>
              <p className="mt-1 truncate text-[10px] text-[var(--lm-subtle)]">{item.detail}</p>
            </div>
            <span className="hidden rounded-full bg-[var(--lm-surface-2)] px-2 py-1 text-[10px] font-semibold text-[var(--lm-muted)] sm:inline-flex">{item.category}</span>
          </div>
        )) : (
          <div className="flex min-h-[150px] flex-col items-center justify-center text-center">
            <span className="lm-empty-icon"><Activity size={18} aria-hidden="true" /></span>
            <p className="mt-3 text-[12px] font-semibold text-[var(--lm-ink)]">Activity feed is ready</p>
            <p className="mt-1 max-w-[260px] text-[11px] leading-5 text-[var(--lm-subtle)]">Connect audit events to show the latest operator actions here.</p>
          </div>
        )}
      </div>
    </section>
  );
}

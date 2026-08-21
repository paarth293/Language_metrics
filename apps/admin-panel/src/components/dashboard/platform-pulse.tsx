import { Activity, CheckCircle2 } from "lucide-react";

export function PlatformPulse({ preview }: { preview: boolean }) {
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#d5e9e4] bg-[var(--lm-teal-wash)] px-4 py-3.5 dark:border-[#2b5d5b] dark:bg-[var(--lm-teal-soft)]" aria-label="Platform status">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lm-teal-soft)] text-[var(--lm-teal-deep)]">
          {preview ? <Activity size={15} aria-hidden="true" /> : <CheckCircle2 size={15} aria-hidden="true" />}
        </span>
        <div>
          <p className="text-[12px] font-bold text-[var(--lm-teal-deep)]">Platform pulse <span className="mx-1 text-[var(--lm-subtle)]">•</span> {preview ? "Live data connected" : "All core services are operating normally"}</p>
          <p className="mt-0.5 text-[10px] text-[var(--lm-muted)]">{preview ? "Operational counts are ready; historical trend data will appear here when connected." : "Dashboard, payments, and teaching operations are within their expected range."}</p>
        </div>
      </div>
      <span className="lm-mono text-[10px] font-semibold text-[var(--lm-teal-deep)]">{preview ? "Current snapshot" : "99.98% uptime this month"}</span>
    </section>
  );
}

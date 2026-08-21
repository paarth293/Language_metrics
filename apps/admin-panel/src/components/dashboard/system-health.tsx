import { CheckCircle2, ShieldCheck } from "lucide-react";

export interface HealthMetric {
  label: string;
  value: string;
  progress: number | null;
  tone: "teal" | "amber" | "slate";
}

export function SystemHealth({ metrics }: { metrics: HealthMetric[] }) {
  return (
    <section className="lm-panel p-6" aria-labelledby="system-health-title">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="lm-kicker">System health</p>
          <h2 id="system-health-title" className="mt-2 text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Operational</h2>
          <p className="mt-1 text-[11px] text-[var(--lm-muted)]">Live service status summary.</p>
        </div>
        <span className="lm-status lm-status--teal">Healthy</span>
      </div>

      <div className="mt-6 space-y-5">
        {metrics.map((metric) => (
          <div key={metric.label}>
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] text-[var(--lm-muted)]">{metric.label}</span>
              <span className="lm-mono text-[11px] font-semibold text-[var(--lm-teal-deep)]">{metric.value}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--lm-surface-2)]">
              <div
                className={metric.tone === "amber" ? "h-full rounded-full bg-[#d1a765]" : metric.tone === "slate" ? "h-full rounded-full bg-[var(--lm-line-strong)]" : "h-full rounded-full bg-[#55ad9f]"}
                style={{ width: `${metric.progress ?? 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[var(--lm-line)] pt-4">
        <span className="flex items-center gap-2 text-[10px] text-[var(--lm-subtle)]"><ShieldCheck size={14} className="text-[var(--lm-teal)]" aria-hidden="true" /> Security checks are enabled</span>
        <span className="flex items-center gap-1 text-[10px] font-semibold text-[var(--lm-teal-deep)]"><CheckCircle2 size={12} aria-hidden="true" /> Ready</span>
      </div>
    </section>
  );
}

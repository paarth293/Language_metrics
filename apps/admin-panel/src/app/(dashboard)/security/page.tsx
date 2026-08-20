import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export default async function SecurityPage() {
  await requireAdmin();
  const [events, attempts, admins] = await Promise.all([
    db.securityEvent.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.loginAttempt.findMany({ orderBy: { createdAt: "desc" }, take: 100 }),
    db.adminUser.findMany({ orderBy: { createdAt: "desc" } }),
  ]);

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };
  const sevColors: Record<string, string> = {
    INFO: "var(--lm-text-subtle)",
    WARN: "var(--lm-accent)",
    CRITICAL: "var(--lm-err)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Platform Security & Monitoring</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Login history, IP logs, failed attempts, and suspicious activity.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div style={cardStyle} className="rounded-xl p-6">
          <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold mb-4">Security Events</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {events.map((e) => (
              <div key={e.id} className="flex items-start justify-between border-b border-[var(--lm-border)] pb-2">
                <div>
                  <p style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{e.type}</p>
                  <p style={{ color: "var(--lm-text-muted)" }} className="text-[12px]">{e.details}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span style={{ color: sevColors[e.severity] ?? "var(--lm-text-muted)" }} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase">{e.severity}</span>
                  <span style={{ color: "var(--lm-text-subtle)" }} className="text-[11px]">{e.createdAt.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {events.length === 0 && <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No security events recorded.</p>}
          </div>
        </div>

        <div style={cardStyle} className="rounded-xl p-6">
          <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold mb-4">Recent Login Attempts</h2>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {attempts.map((a) => (
              <div key={a.id} className="flex items-start justify-between border-b border-[var(--lm-border)] pb-2">
                <div>
                  <p style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{a.email}</p>
                  <p style={{ color: "var(--lm-text-muted)" }} className="text-[12px]">IP: {a.ip ?? "unknown"}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span style={{ color: a.result === "SUCCESS" ? "var(--lm-ok)" : a.result === "FAILED" ? "var(--lm-err)" : "var(--lm-accent)" }} className="px-2 py-0.5 rounded text-[10px] font-bold uppercase">{a.result}</span>
                  <span style={{ color: "var(--lm-text-subtle)" }} className="text-[11px]">{a.createdAt.toLocaleString()}</span>
                </div>
              </div>
            ))}
            {attempts.length === 0 && <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No login attempts recorded.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

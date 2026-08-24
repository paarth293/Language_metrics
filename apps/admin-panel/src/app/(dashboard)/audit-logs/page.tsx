import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export default async function AuditLogsPage() {
  await requireAdmin();
  const logs = await db.adminAuditLog.findMany({
    include: { admin: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Audit Log</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Every important admin action is recorded for accountability.</p>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Timestamp", "Admin", "Action", "Target", "Details"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px] whitespace-nowrap">{l.createdAt.toLocaleString()}</td>
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px]">{l.admin?.email ?? "System"}</td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: "var(--lm-accent)" }} className="px-2 py-0.5 rounded text-[11px] font-bold bg-[var(--lm-accent-bg)]">{l.eventType}</span>
                  </td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{l.actorId?.slice(0, 12) ?? "—"}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[12px] max-w-[300px] truncate">{l.outcome ?? "—"}</td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr><td colSpan={5} className="py-14 text-center"><p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No audit entries yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



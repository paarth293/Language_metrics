import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  await requireAdmin();
  const templates = await db.notificationTemplate.findMany({ orderBy: { createdAt: "desc" } });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Communication Management</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Send notifications via push, email, SMS, and in-app announcements.</p>
        </div>
        <button style={{ background: "var(--lm-accent)", color: "#000" }} className="px-4 py-2 rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity">
          New Notification
        </button>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Template", "Channel", "Title", "Audience", "Status", "Last Sent"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px] font-medium">{t.name}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{t.channel}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{t.title}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{t.audience}</td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: t.isActive ? "var(--lm-ok)" : "var(--lm-err)" }} className="px-2 py-0.5 rounded text-[11px] font-medium">{t.isActive ? "Active" : "Inactive"}</span>
                  </td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{t.lastSentAt?.toLocaleString() ?? "Never"}</td>
                </tr>
              ))}
              {templates.length === 0 && (
                <tr><td colSpan={6} className="py-14 text-center"><p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No notification templates yet.</p></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

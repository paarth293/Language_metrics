import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { ROLE_LABELS } from "@/lib/permissions";

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const admin = await requireAdmin();
  const admins = await db.adminUser.findMany({ orderBy: { createdAt: "desc" } });

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };
  const statusColors: Record<string, string> = {
    ACTIVE: "var(--lm-ok)",
    SUSPENDED: "var(--lm-err)",
    DISABLED: "var(--lm-text-subtle)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Admin Users & Permissions</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Role-based access control. Super Admin has full access.</p>
        </div>
        {admin.isSuperAdmin && (
          <button style={{ background: "var(--lm-accent)", color: "#000" }} className="px-4 py-2 rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity">
            Invite Admin
          </button>
        )}
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Admin", "Email", "Role", "Permissions", "Status", "Last Login"].map((h) => (
                  <th key={h} style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.userId} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px] font-medium">
                    {a.name}{a.isSuperAdmin && <span style={{ color: "var(--lm-accent)" }} className="ml-2 text-[10px] font-bold uppercase">Owner</span>}
                  </td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{a.email}</td>
                  <td style={{ color: "var(--lm-text)" }} className="py-3.5 px-5 text-[13px]">{ROLE_LABELS[a.roleKey] ?? a.roleKey}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{a.permissions.length > 0 ? a.permissions.length + " overrides" : "Role preset"}</td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: statusColors[a.status] ?? "var(--lm-text-muted)" }} className="px-2 py-0.5 rounded text-[11px] font-medium">{a.status}</span>
                  </td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="py-3.5 px-5 text-[13px]">{a.lastLoginAt ? a.lastLoginAt.toLocaleString() : "Never"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

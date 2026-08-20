import { db } from "@repo/database";
import { MoreHorizontal } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function TeachersPage() {
  const teachers = await db.teacherProfile.findMany({
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px]">
          <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
          <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
          <span style={{ color: "var(--lm-text-muted)" }}>Verification</span>
        </div>
        <button style={{ color: "var(--lm-text-subtle)" }}>
          <MoreHorizontal size={16} />
        </button>
      </div>

      {/* Table */}
      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Teacher Name", "Applied On", "Status", "Action"].map((h, i) => (
                  <th
                    key={h}
                    style={{ color: "var(--lm-text-subtle)" }}
                    className={`py-3 px-5 text-[11px] font-semibold uppercase tracking-wider ${i === 3 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {teachers.map((teacher) => (
                <tr
                  key={teacher.userId}
                  style={{ borderBottom: "1px solid var(--lm-border)" }}
                  className="hover:bg-gray-800/40 transition-colors group"
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div style={{ background: "var(--lm-surface2)" }}
                        className="h-7 w-7 rounded-full overflow-hidden shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(teacher.name)}&backgroundColor=transparent`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{teacher.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">
                      {teacher.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    {teacher.status === 'PENDING' && (
                      <span style={{ background: "var(--lm-accent-bg)", color: "var(--lm-accent)", border: "1px solid rgba(99,102,241,0.25)" }}
                        className="px-2 py-0.5 rounded text-[11px] font-medium">Pending</span>
                    )}
                    {teacher.status === 'APPROVED' && (
                      <span style={{ background: "var(--lm-ok-bg)", color: "var(--lm-ok)", border: "1px solid rgba(16,185,129,0.25)" }}
                        className="px-2 py-0.5 rounded text-[11px] font-medium">Approved</span>
                    )}
                    {teacher.status === 'REJECTED' && (
                      <span style={{ background: "var(--lm-err-bg)", color: "var(--lm-err)", border: "1px solid rgba(239,68,68,0.25)" }}
                        className="px-2 py-0.5 rounded text-[11px] font-medium">Rejected</span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <button
                      style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }}
                      className="px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No teacher applications found.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

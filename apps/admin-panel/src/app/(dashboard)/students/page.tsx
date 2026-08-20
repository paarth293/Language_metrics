import { Users, Search, Filter } from "lucide-react";
import { db } from "@repo/database";

export const dynamic = 'force-dynamic';

export default async function StudentsPage() {
  const students = await db.studentProfile.findMany({
    include: {
      user: true,
    },
    take: 20,
    orderBy: { user: { createdAt: 'desc' } }
  });

  return (
    <div className="p-8 space-y-8 pb-12 max-w-[1400px]">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 style={{ color: "var(--lm-accent)" }} className="text-3xl font-bold tracking-tight mb-1">Students</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] font-medium">Manage and view all enrolled learners.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "var(--lm-text-subtle)" }} />
            <input
              type="text"
              placeholder="Search students..."
              style={{
                background: "var(--lm-surface)",
                border: "1px solid var(--lm-border)",
                color: "var(--lm-text)",
              }}
              className="w-[250px] rounded-md py-2 pl-9 pr-3 text-[13px] font-medium outline-none focus:border-yellow-500/50 transition-colors"
            />
          </div>
          <button style={{ border: "1px solid var(--lm-border)", color: "var(--lm-text)" }} className="flex items-center gap-2 px-4 py-2 rounded-md text-[13px] font-semibold bg-[var(--lm-surface)] hover:bg-[var(--lm-surface2)] transition-colors">
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ background: "var(--lm-surface)", border: "1px solid var(--lm-border)" }} className="rounded-xl overflow-hidden">
        {students.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--lm-border)", background: "var(--lm-surface2)" }}>
                <th style={{ color: "var(--lm-text-subtle)" }} className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Student Name</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Email</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Native Language</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="px-6 py-4 text-[11px] font-bold uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.userId} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div style={{ background: "var(--lm-surface2)" }} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-[var(--lm-border)]">
                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${student.name}&backgroundColor=transparent`} className="w-7 h-7 rounded-full" />
                      </div>
                      <span style={{ color: "var(--lm-text)" }} className="text-[13px] font-bold">{student.name}</span>
                    </div>
                  </td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="px-6 py-4 text-[13px]">{student.user.email}</td>
                  <td style={{ color: "var(--lm-text-muted)" }} className="px-6 py-4 text-[13px]">{student.languageToLearn || "Not specified"}</td>
                  <td className="px-6 py-4">
                    <span style={{ background: "var(--lm-ok-bg)", color: "var(--lm-ok)" }} className="text-[10px] font-bold px-2 py-1 rounded tracking-wider uppercase">
                      Active
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-12 flex flex-col items-center justify-center text-center">
            <div style={{ background: "var(--lm-surface2)" }} className="w-16 h-16 rounded-full flex items-center justify-center mb-4">
              <Users size={24} style={{ color: "var(--lm-text-muted)" }} />
            </div>
            <h3 style={{ color: "var(--lm-text)" }} className="text-lg font-bold mb-1">No Students Yet</h3>
            <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] max-w-sm">When users register as students, they will appear in this directory.</p>
          </div>
        )}
      </div>
    </div>
  );
}

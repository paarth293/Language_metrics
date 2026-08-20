import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { MoreHorizontal, Search, Filter } from "lucide-react";
import Link from "next/link";
import { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: { filter?: string; q?: string };
}) {
  await requireAdmin();

  // Resolve search parameters for Next 15 compatible way
  const filter = searchParams.filter || "all";
  const q = searchParams.q || "";

  // Build the query where clause
  let whereClause: Prisma.TeacherProfileWhereInput = {};

  if (q) {
    whereClause.name = { contains: q, mode: "insensitive" };
  }

  if (filter === "pending") {
    whereClause.status = "PENDING";
  } else if (filter === "suspended") {
    // Assuming you have a suspended status, or we map it
    // Wait, the schema has: PENDING, INTERVIEW_SCHEDULED, APPROVED, REJECTED.
    // Suspended might be an overarching User status or a new Teacher status. Let's use REJECTED as a placeholder for suspended for now.
    whereClause.status = "REJECTED";
  }

  const teachers = await db.teacherProfile.findMany({
    where: whereClause,
    include: { user: true },
    orderBy: { createdAt: 'desc' }
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  const activeTabStyle = "border-b-2 border-indigo-500 text-indigo-400 font-medium";
  const inactiveTabStyle = "text-gray-400 hover:text-gray-300 transition-colors";

  return (
    <div className="p-7 space-y-6 pb-10">
      {/* Breadcrumb & Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Teacher Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Teachers</span>
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: "var(--lm-border2)" }}>
        <div className="flex gap-6 text-sm">
          <Link href="/teachers?filter=all" className={`pb-3 px-1 ${filter === 'all' ? activeTabStyle : inactiveTabStyle}`}>
            All Teachers
          </Link>
          <Link href="/teachers?filter=pending" className={`pb-3 px-1 ${filter === 'pending' ? activeTabStyle : inactiveTabStyle}`}>
            Pending Approval
          </Link>
          <Link href="/teachers?filter=suspended" className={`pb-3 px-1 ${filter === 'suspended' ? activeTabStyle : inactiveTabStyle}`}>
            Suspended / Rejected
          </Link>
        </div>
        
        <form className="pb-2 flex items-center relative">
          <Search size={16} className="absolute left-3 text-gray-500" />
          <input 
            type="text" 
            name="q"
            defaultValue={q}
            placeholder="Search teachers..." 
            className="pl-9 pr-4 py-1.5 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500"
          />
          <input type="hidden" name="filter" value={filter} />
        </form>
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
                    {(teacher.status === 'REJECTED' || teacher.status === 'INTERVIEW_SCHEDULED') && (
                      <span style={{ background: "var(--lm-err-bg)", color: "var(--lm-err)", border: "1px solid rgba(239,68,68,0.25)" }}
                        className="px-2 py-0.5 rounded text-[11px] font-medium">
                        {teacher.status === 'REJECTED' ? 'Rejected' : 'Interview'}
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/teachers/${teacher.userId}`}
                      style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }}
                      className="inline-block px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
              {teachers.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-14 text-center">
                    <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No teachers found.</p>
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

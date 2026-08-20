import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import Link from "next/link";
import { Search } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function ComplaintsPage({ searchParams }: { searchParams: { filter?: string, q?: string } }) {
  await requireAdmin();

  const filter = searchParams.filter || "open";
  
  let statusFilter: any = {};
  if (filter === "resolved") {
    statusFilter = { in: ["RESOLVED", "CLOSED"] };
  } else if (filter !== "all") {
    // Default to "open" for any other unknown filter values
    statusFilter = { in: ["NEW", "INVESTIGATING", "ACTION_REQUIRED"] };
  }

  const complaintsData = await db.complaint.findMany({
    where: filter === "all" ? {} : { status: statusFilter },
    orderBy: { createdAt: 'desc' }
  });

  const studentIds = complaintsData.map(c => c.studentId).filter(Boolean) as string[];
  const teacherIds = complaintsData.map(c => c.teacherId).filter(Boolean) as string[];

  const students = await db.studentProfile.findMany({ where: { userId: { in: studentIds } } });
  const teachers = await db.teacherProfile.findMany({ where: { userId: { in: teacherIds } } });

  const complaints = complaintsData.map(c => ({
    ...c,
    student: students.find(s => s.userId === c.studentId) || { name: 'Unknown' },
    teacher: teachers.find(t => t.userId === c.teacherId) || { name: 'Unknown' },
  }));

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  const activeTabStyle = "border-b-2 border-indigo-500 text-indigo-400 font-medium";
  const inactiveTabStyle = "text-gray-400 hover:text-gray-300 transition-colors";

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Dispute Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Complaints</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: "var(--lm-border2)" }}>
        <div className="flex gap-6 text-sm overflow-x-auto">
          <Link href="/complaints?filter=all" className={`pb-3 px-1 whitespace-nowrap ${filter === 'all' ? activeTabStyle : inactiveTabStyle}`}>All Tickets</Link>
          <Link href="/complaints?filter=open" className={`pb-3 px-1 whitespace-nowrap ${filter === 'open' ? activeTabStyle : inactiveTabStyle}`}>Open Tickets</Link>
          <Link href="/complaints?filter=resolved" className={`pb-3 px-1 whitespace-nowrap ${filter === 'resolved' ? activeTabStyle : inactiveTabStyle}`}>Resolved</Link>
        </div>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Ticket ID</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Subject</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Student</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Teacher</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase">Status</th>
                <th style={{ color: "var(--lm-text-subtle)" }} className="py-3 px-5 text-[11px] font-semibold uppercase text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {complaints.map((complaint) => (
                <tr key={complaint.id} style={{ borderBottom: "1px solid var(--lm-border)" }} className="hover:bg-gray-800/40 transition-colors">
                  <td className="py-3.5 px-5 text-[13px] text-gray-400 font-mono">
                    #{complaint.id.split('-')[0].toUpperCase()}
                  </td>
                  <td className="py-3.5 px-5 text-[13px] text-white">
                    {complaint.subject || "No Subject"}
                  </td>
                  <td className="py-3.5 px-5 text-[13px] text-white">{complaint.student.name}</td>
                  <td className="py-3.5 px-5 text-[13px] text-white">{complaint.teacher.name}</td>
                  <td className="py-3.5 px-5">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                      complaint.status === 'RESOLVED' || complaint.status === 'CLOSED' ? 'bg-green-900/30 text-green-400' :
                      complaint.status === 'ACTION_REQUIRED' ? 'bg-red-900/30 text-red-400' :
                      'bg-yellow-900/30 text-yellow-400'
                    }`}>
                      {complaint.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/complaints/${complaint.id}`}
                      style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }}
                      className="inline-block px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">
                      View Ticket
                    </Link>
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-14 text-center text-gray-500 text-sm">No tickets found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { MoreHorizontal, Search } from "lucide-react";
import Link from "next/link";
import { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requireAdmin();

  const q = searchParams.q || "";

  let whereClause: Prisma.StudentProfileWhereInput = {};
  if (q) {
    whereClause.name = { contains: q, mode: "insensitive" };
  }

  const students = await db.studentProfile.findMany({
    where: whereClause,
    include: {
      user: true,
    },
    take: 50,
    orderBy: { user: { createdAt: 'desc' } }
  });

  const cardStyle = {
    background: "var(--lm-surface)",
    border: "1px solid var(--lm-border2)",
  };

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white mb-1">Student Management</h1>
          <div className="flex items-center gap-2 text-[13px]">
            <span style={{ color: "var(--lm-text)" }} className="font-semibold">Dashboard</span>
            <span style={{ color: "var(--lm-text-subtle)" }}>/</span>
            <span style={{ color: "var(--lm-text-muted)" }}>Students</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b" style={{ borderColor: "var(--lm-border2)" }}>
        <div className="flex gap-6 text-sm">
          <span className="pb-3 px-1 border-b-2 border-indigo-500 text-indigo-400 font-medium">All Students</span>
        </div>
        
        <form className="pb-2 flex items-center relative">
          <Search size={16} className="absolute left-3 text-gray-500" />
          <input 
            type="text" 
            name="q"
            defaultValue={q}
            placeholder="Search students..." 
            className="pl-9 pr-4 py-1.5 text-sm rounded bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-indigo-500"
          />
        </form>
      </div>

      <div style={cardStyle} className="rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ background: "var(--lm-bg)", borderBottom: "1px solid var(--lm-border2)" }}>
                {["Student Name", "Joined On", "Language", "Proficiency", "Action"].map((h, i) => (
                  <th
                    key={h}
                    style={{ color: "var(--lm-text-subtle)" }}
                    className={`py-3 px-5 text-[11px] font-semibold uppercase tracking-wider ${i === 4 ? "text-right" : ""}`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr
                  key={student.userId}
                  style={{ borderBottom: "1px solid var(--lm-border)" }}
                  className="hover:bg-gray-800/40 transition-colors group"
                >
                  <td className="py-3.5 px-5">
                    <div className="flex items-center gap-3">
                      <div style={{ background: "var(--lm-surface2)" }}
                        className="h-7 w-7 rounded-full overflow-hidden shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=transparent`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <span style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{student.name}</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">
                      {student.user.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">
                      {student.languageToLearn}
                    </span>
                  </td>
                  <td className="py-3.5 px-5">
                    <span style={{ background: "var(--lm-surface2)", border: "1px solid var(--lm-border2)", color: "var(--lm-text)" }}
                      className="px-2 py-0.5 rounded text-[11px] font-medium">
                      {student.proficiencyLevel}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-right">
                    <Link
                      href={`/students/${student.userId}`}
                      style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }}
                      className="inline-block px-3 py-1 rounded text-[12px] font-medium hover:bg-gray-700 hover:text-white transition-colors">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-14 text-center">
                    <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">No students found.</p>
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

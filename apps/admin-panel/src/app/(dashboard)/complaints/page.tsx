import { Inbox } from "lucide-react";
import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import Link from "next/link";
import { Pagination } from "@/components/Pagination";
import { SearchInput } from "@/components/SearchInput";

export const dynamic = 'force-dynamic';

const tabs = [
  { key: "all", label: "All Tickets", href: "/complaints?filter=all" },
  { key: "open", label: "Open Tickets", href: "/complaints?filter=open" },
  { key: "resolved", label: "Resolved", href: "/complaints?filter=resolved" },
] as const;

export default async function ComplaintsPage(props: { searchParams: Promise<{ filter?: string, q?: string, page?: string }> }) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  const filter = searchParams.filter || "open";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const q = searchParams.q || "";
  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let statusFilter: any = {};
  if (filter === "resolved") {
    statusFilter = { in: ["RESOLVED", "CLOSED"] };
  } else if (filter !== "all") {
    statusFilter = { in: ["NEW", "INVESTIGATING", "ACTION_REQUIRED"] };
  }

  const [complaintsData, totalCount] = await Promise.all([
    db.complaint.findMany({
      where: filter === "all" ? {} : { status: statusFilter },
      select: {
        id: true,
        subject: true,
        status: true,
        studentId: true,
        teacherId: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize
    }),
    db.complaint.count({
      where: filter === "all" ? {} : { status: statusFilter }
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasFilters = filter !== "open";

  const studentIds = complaintsData.map(c => c.studentId).filter(Boolean) as string[];
  const teacherIds = complaintsData.map(c => c.teacherId).filter(Boolean) as string[];

  const students = await db.studentProfile.findMany({ where: { userId: { in: studentIds } }, select: { userId: true, name: true } });
  const teachers = await db.teacherProfile.findMany({ where: { userId: { in: teacherIds } }, select: { userId: true, name: true } });

  const complaints = complaintsData.map(c => ({
    ...c,
    student: students.find(s => s.userId === c.studentId) || { name: 'Unknown' },
    teacher: teachers.find(t => t.userId === c.teacherId) || { name: 'Unknown' },
  }));

  const getStatusStyle = (status: string) => {
    if (status === 'RESOLVED' || status === 'CLOSED') return "lm-status lm-status--teal";
    if (status === 'ACTION_REQUIRED') return "lm-status lm-status--red";
    return "lm-status lm-status--amber";
  };

  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
            <span>Dashboard</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Complaints</span>
          </div>
          <h1 className="lm-page-title">Dispute Management</h1>
          <p className="lm-body-copy mt-2">Manage student and teacher disputes, monitor resolutions, and enforce policies.</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--lm-line)]">
          <nav aria-label="Complaint views" className="flex min-w-0 gap-6 overflow-x-auto">
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <Link
                  key={tab.key}
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={`border-b-2 px-1 pb-3 text-[12px] font-semibold transition-colors ${
                    active ? "border-[var(--lm-teal)] text-[var(--lm-teal-deep)]" : "border-transparent text-[var(--lm-muted)] hover:text-[var(--lm-ink-strong)]"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="pb-2">
            <SearchInput placeholder="Search tickets" />
          </div>
        </div>
      </div>

      <section className="lm-panel mt-6 overflow-hidden" aria-labelledby="complaints-directory-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lm-line)] px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id="complaints-directory-title" className="text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Tickets</h2>
              <span className="rounded-full bg-[var(--lm-teal-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--lm-teal-deep)]">{totalCount} records</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--lm-muted)]">Latest complaints and dispute tickets.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <caption className="sr-only">Complaints directory</caption>
            <thead>
              <tr className="border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)]">
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Ticket ID</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Subject</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Student</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Teacher</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Status</th>
                <th scope="col" className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--lm-line)]">
              {complaints.map((complaint) => (
                <tr key={complaint.id} className="group transition-colors hover:bg-[var(--lm-hover)]">
                  <td className="px-6 py-4">
                    <p className="lm-mono text-[12px] text-[var(--lm-muted)]">#{complaint.id.split('-')[0].toUpperCase()}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="truncate text-[12px] font-bold text-[var(--lm-ink)]">{complaint.subject || "No Subject"}</p>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[var(--lm-muted)]">
                    {complaint.student.name}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[var(--lm-muted)]">
                    {complaint.teacher.name}
                  </td>
                  <td className="px-6 py-4">
                    <span className={getStatusStyle(complaint.status)}>
                      {complaint.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/complaints/${complaint.id}`} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--lm-line)] px-3 text-[11px] font-bold text-[var(--lm-teal-deep)] transition-colors hover:border-[var(--lm-teal)] hover:bg-[var(--lm-teal-soft)]">
                      View Ticket
                    </Link>
                  </td>
                </tr>
              ))}
              {complaints.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center">
                    <span className="lm-empty-icon"><Inbox size={19} aria-hidden="true" /></span>
                    <p className="mt-4 text-[13px] font-bold text-[var(--lm-ink)]">
                      {hasFilters ? "No tickets match these filters" : "No open tickets."}
                    </p>
                    <p className="mx-auto mt-1 max-w-[320px] text-[11px] leading-5 text-[var(--lm-subtle)]">
                      {hasFilters ? "Try clearing the search or switching to another view." : "New tickets will appear here when they are submitted."}
                    </p>
                    {hasFilters && (
                      <Link href="/complaints?filter=all" className="lm-button-secondary mt-5 min-h-9 px-3 text-[11px]">Clear filters</Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} />
      </section>
    </div>
  );
}

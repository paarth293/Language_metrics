import { Inbox } from "lucide-react";
import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import { statusClass, statusLabel } from "@/components/dashboard/teacher-approval-table";
import type { ApprovalStatus } from "@/components/dashboard/types";
import Link from "next/link";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

const tabs = [
  { key: "approved", label: "Approved teachers", href: "/teachers?filter=approved" },
  { key: "pending", label: "Pending approval", href: "/teachers?filter=pending" },
  { key: "suspended", label: "Suspended / rejected", href: "/teachers?filter=suspended" },
] as const;

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "NA";
}

export default async function TeachersPage(props: {
  searchParams: Promise<{ filter?: string; q?: string; page?: string }>;
}) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  const filter = searchParams.filter || "approved";
  const q = searchParams.q || "";
  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.TeacherProfileWhereInput = {};

  if (q) whereClause.name = { contains: q, mode: "insensitive" };
  if (filter === "approved") whereClause.status = "APPROVED";
  if (filter === "pending") whereClause.status = { in: ["PENDING", "INTERVIEW_SCHEDULED"] };
  if (filter === "suspended") whereClause.status = "REJECTED";

  const [teachers, totalCount] = await Promise.all([
    db.teacherProfile.findMany({
      where: whereClause,
      select: { userId: true, name: true, language: true, status: true, createdAt: true, user: { select: { email: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
    db.teacherProfile.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);
  const hasFilters = Boolean(q) || filter !== "approved";

  return (
    <div className="mx-auto max-w-[1230px] px-6 pb-4 pt-2 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]"><span>People</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Teachers</span></div>
          <h1 className="lm-page-title">Teacher approvals</h1>
          <p className="lm-body-copy mt-1">Review applications, verify teaching profiles, and keep the network healthy.</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--lm-line)]">
          <nav aria-label="Teacher views" className="flex min-w-0 gap-6 overflow-x-auto">
            {tabs.map((tab) => {
              const active = filter === tab.key;
              return <Link key={tab.key} href={tab.href} aria-current={active ? "page" : undefined} className={`border-b-2 px-1 pb-3 text-[12px] font-semibold transition-colors ${active ? "border-[var(--lm-teal)] text-[var(--lm-teal-deep)]" : "border-transparent text-[var(--lm-muted)] hover:text-[var(--lm-ink-strong)]"}`}>{tab.label}</Link>;
            })}
          </nav>
          <div className="pb-2"><SearchInput placeholder="Search teachers" /></div>
        </div>
      </div>

      <section className="lm-panel mt-3 overflow-hidden" aria-labelledby="teacher-directory-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lm-line)] px-5 py-4">
          <div>
            <div className="flex items-center gap-2.5"><h2 id="teacher-directory-title" className="text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Teacher directory</h2><span className="rounded-full bg-[var(--lm-teal-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--lm-teal-deep)]">{totalCount} records</span></div>
            <p className="mt-1.5 text-[11px] text-[var(--lm-muted)]">Latest applications appear first. Select a profile to review documents and actions.</p>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-[var(--lm-subtle)]"><span className="h-1.5 w-1.5 rounded-full bg-[var(--lm-teal)]" /> Live queue</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">Teacher approval directory</caption>
            <thead>
              <tr className="border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)]">
                <th scope="col" className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Teacher</th>
                <th scope="col" className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Applied on</th>
                <th scope="col" className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Language</th>
                <th scope="col" className="px-5 py-2.5 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Status</th>
                <th scope="col" className="px-5 py-2.5 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--lm-line)]">
              {teachers.map((teacher) => {
                const approvalStatus = teacher.status as ApprovalStatus;
                return (
                  <tr key={teacher.userId} className="group transition-colors hover:bg-[var(--lm-hover)]">
                    <td className="px-5 py-3"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lm-teal-soft)] text-[11px] font-bold text-[var(--lm-teal-deep)]">{initials(teacher.name)}</span><div className="min-w-0"><p className="truncate text-[12px] font-bold text-[var(--lm-ink)]">{teacher.name}</p><p className="mt-0.5 truncate text-[10px] text-[var(--lm-subtle)]">{teacher.user.email}</p></div></div></td>
                    <td className="whitespace-nowrap px-5 py-3 text-[12px] text-[var(--lm-muted)]">{formatDate(teacher.createdAt)}</td>
                    <td className="px-5 py-3 text-[12px] text-[var(--lm-muted)]">{teacher.language || "Not specified"}</td>
                    <td className="px-5 py-3"><span className={statusClass(approvalStatus)}>{statusLabel(approvalStatus)}</span></td>
                    <td className="px-5 py-3 text-right"><Link href={`/teachers/${teacher.userId}`} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--lm-line)] px-3 text-[11px] font-bold text-[var(--lm-teal-deep)] transition-colors hover:border-[var(--lm-teal)] hover:bg-[var(--lm-teal-soft)]">{approvalStatus === "PENDING" || approvalStatus === "REJECTED" ? "Review profile" : "View profile"}</Link></td>
                  </tr>
                );
              })}
              {teachers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <span className="lm-empty-icon"><Inbox size={19} aria-hidden="true" /></span>
                    <p className="mt-4 text-[13px] font-bold text-[var(--lm-ink)]">{hasFilters ? "No teachers match these filters" : "No teacher applications yet"}</p>
                    <p className="mx-auto mt-1 max-w-[320px] text-[11px] leading-5 text-[var(--lm-subtle)]">{hasFilters ? "Try clearing the search or switching to another view." : "New teacher applications will appear here when they are submitted."}</p>
                    {hasFilters ? <Link href="/teachers" className="lm-button-secondary mt-5 min-h-9 px-3 text-[11px]">Clear filters</Link> : null}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <Pagination currentPage={page} totalPages={totalPages} />
      </section>
    </div>
  );
}

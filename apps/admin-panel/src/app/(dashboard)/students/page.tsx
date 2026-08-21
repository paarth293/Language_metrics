import { Users } from "lucide-react";
import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { SearchInput } from "@/components/SearchInput";
import { Pagination } from "@/components/Pagination";
import Link from "next/link";
import { Prisma } from "@prisma/client";

export const dynamic = 'force-dynamic';

export default async function StudentsPage(props: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  const q = searchParams.q || "";
  const page = Math.max(parseInt(searchParams.page || "1", 10), 1);
  const pageSize = 20;
  const skip = (page - 1) * pageSize;

  const whereClause: Prisma.StudentProfileWhereInput = {};
  if (q) {
    whereClause.name = { contains: q, mode: "insensitive" };
  }

  const [students, totalCount] = await Promise.all([
    db.studentProfile.findMany({
      where: whereClause,
      select: {
        userId: true,
        name: true,
        languageToLearn: true,
        proficiencyLevel: true,
        user: { select: { email: true, createdAt: true } },
      },
      skip,
      take: pageSize,
      orderBy: { user: { createdAt: 'desc' } }
    }),
    db.studentProfile.count({ where: whereClause })
  ]);
  
  const totalPages = Math.ceil(totalCount / pageSize);
  const hasFilters = Boolean(q);

  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex flex-col gap-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
            <span>People</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Students</span>
          </div>
          <h1 className="lm-page-title">Student Management</h1>
          <p className="lm-body-copy mt-2">Manage student profiles, learning preferences, and platform access.</p>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--lm-line)]">
          <nav aria-label="Student views" className="flex min-w-0 gap-6 overflow-x-auto">
            <Link href="/students" aria-current="page" className="border-b-2 border-[var(--lm-teal)] px-1 pb-3 text-[12px] font-semibold text-[var(--lm-teal-deep)] transition-colors">
              All students
            </Link>
          </nav>
          <div className="pb-2">
            <SearchInput placeholder="Search students" />
          </div>
        </div>
      </div>

      <section className="lm-panel mt-6 overflow-hidden" aria-labelledby="student-directory-title">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--lm-line)] px-6 py-5">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 id="student-directory-title" className="text-[16px] font-bold tracking-[-0.02em] text-[var(--lm-ink-strong)]">Student directory</h2>
              <span className="rounded-full bg-[var(--lm-teal-soft)] px-2 py-1 font-mono text-[10px] font-semibold text-[var(--lm-teal-deep)]">{totalCount} records</span>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--lm-muted)]">All registered students across the platform.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">Student directory</caption>
            <thead>
              <tr className="border-b border-[var(--lm-line)] bg-[var(--lm-paper-muted)]">
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Student Name</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Joined On</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Language</th>
                <th scope="col" className="px-6 py-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Proficiency</th>
                <th scope="col" className="px-6 py-3 text-right text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--lm-subtle)]">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--lm-line)]">
              {students.map((student) => (
                <tr key={student.userId} className="group transition-colors hover:bg-[var(--lm-hover)]">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--lm-teal-soft)] overflow-hidden">
                        <img src={`https://api.dicebear.com/7.x/notionists/svg?seed=${encodeURIComponent(student.name)}&backgroundColor=transparent`} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] font-bold text-[var(--lm-ink)]">{student.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-[var(--lm-subtle)]">{student.user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-[12px] text-[var(--lm-muted)]">
                    {student.user.createdAt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[var(--lm-muted)]">
                    {student.languageToLearn || "Not specified"}
                  </td>
                  <td className="px-6 py-4">
                    <span className="rounded bg-[var(--lm-surface-2)] border border-[var(--lm-line)] px-2 py-0.5 text-[11px] font-medium text-[var(--lm-muted)]">
                      {student.proficiencyLevel || "Beginner"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link href={`/students/${student.userId}`} className="inline-flex min-h-9 items-center rounded-lg border border-[var(--lm-line)] px-3 text-[11px] font-bold text-[var(--lm-teal-deep)] transition-colors hover:border-[var(--lm-teal)] hover:bg-[var(--lm-teal-soft)]">
                      View Profile
                    </Link>
                  </td>
                </tr>
              ))}
              {students.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center">
                    <span className="lm-empty-icon"><Users size={19} aria-hidden="true" /></span>
                    <p className="mt-4 text-[13px] font-bold text-[var(--lm-ink)]">
                      {hasFilters ? "No students match your search" : "No students found."}
                    </p>
                    <p className="mx-auto mt-1 max-w-[320px] text-[11px] leading-5 text-[var(--lm-subtle)]">
                      {hasFilters ? "Try clearing the search or switching to another view." : "Students will appear here once they register."}
                    </p>
                    {hasFilters && (
                      <Link href="/students" className="lm-button-secondary mt-5 min-h-9 px-3 text-[11px]">Clear filters</Link>
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

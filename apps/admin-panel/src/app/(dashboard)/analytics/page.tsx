import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";
import { ArrowDownToLine, TrendingUp, Users, BookOpen, GraduationCap, XCircle, Star, DollarSign } from "lucide-react";

export const dynamic = 'force-dynamic';

function inr(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default async function AnalyticsPage() {
  await requireAdmin();
  const [completed, cancelled, totalRev, newStudents, students, teachers, activeCourses] = await Promise.all([
    db.classSession.count({ where: { status: "COMPLETED" } }),
    db.booking.count({ where: { status: "CANCELLED" } }),
    db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    // eslint-disable-next-line react-hooks/purity
    db.studentProfile.count({ where: { user: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } } }),
    db.studentProfile.count(),
    db.teacherProfile.count(),
    db.course.count({ where: { published: true } }),
  ]);

  const avgRating = await db.review.aggregate({ _avg: { rating: true } });
  const topTeachers = await db.teacherProfile.findMany({
    orderBy: { reviews: { _count: "desc" } },
    take: 5,
    include: { user: true },
  });
  const popularLangs = await db.language.findMany({
    where: { status: "ACTIVE" },
    include: { _count: { select: { courses: true } } },
    orderBy: { name: "asc" },
  });

  const metrics = [
    { label: "Total Revenue", value: inr(totalRev._sum.amount ?? 0), icon: DollarSign, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    { label: "Classes Completed", value: completed.toLocaleString("en-IN"), icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: "Cancellations", value: cancelled.toLocaleString("en-IN"), icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    { label: "Active Courses", value: activeCourses.toLocaleString("en-IN"), icon: BookOpen, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Total Students", value: students.toLocaleString("en-IN"), icon: GraduationCap, color: "text-[var(--lm-teal-deep)]", bg: "bg-[var(--lm-teal-soft)]" },
    { label: "New Students (30d)", value: newStudents.toLocaleString("en-IN"), icon: Users, color: "text-[var(--lm-teal-deep)]", bg: "bg-[var(--lm-teal-soft)]" },
    { label: "Total Teachers", value: teachers.toLocaleString("en-IN"), icon: Users, color: "text-[var(--lm-amber)]", bg: "bg-[var(--lm-amber-soft)]" },
    { label: "Avg Teacher Rating", value: (Math.round((avgRating._avg.rating ?? 0) * 10) / 10).toFixed(1), icon: Star, color: "text-[var(--lm-amber)]", bg: "bg-[var(--lm-amber-soft)]" },
  ];

  return (
    <div className="mx-auto max-w-[1230px] px-9 pb-12 pt-9 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex flex-col gap-5 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
              <span>Overview</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Reports & Analytics</span>
            </div>
            <h1 className="lm-page-title">Reports & Analytics</h1>
            <p className="lm-body-copy mt-2">Revenue, teacher, student, language, and operations insights.</p>
          </div>
          <button className="lm-button-secondary min-h-9 px-4 text-[12px] flex items-center gap-2">
            <ArrowDownToLine size={14} /> Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="lm-panel flex flex-col p-5 hover:shadow-md transition-shadow relative overflow-hidden group">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-bold tracking-[0.06em] text-[var(--lm-subtle)] uppercase">{m.label}</p>
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${m.bg} ${m.color}`}>
                  <Icon size={16} strokeWidth={2.5} />
                </div>
              </div>
              <h3 className="text-[28px] font-bold tracking-tight text-[var(--lm-ink-strong)]">{m.value}</h3>
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-transparent via-[var(--lm-line)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lm-panel overflow-hidden">
          <div className="border-b border-[var(--lm-line)] px-6 py-5 bg-[var(--lm-paper-muted)]">
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--lm-ink-strong)]">Top Performing Teachers</h2>
            <p className="mt-1 text-[11px] text-[var(--lm-muted)]">Based on highest number of student reviews.</p>
          </div>
          <div className="p-2">
            {topTeachers.map((t, i) => (
              <div key={t.userId} className="flex items-center justify-between p-4 hover:bg-[var(--lm-hover)] rounded-lg transition-colors group border-b border-[var(--lm-line)] last:border-0">
                <div className="flex items-center gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--lm-teal-soft)] text-[12px] font-bold text-[var(--lm-teal-deep)] ring-2 ring-[var(--lm-paper)] shadow-sm">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--lm-ink)]">{t.name}</p>
                    <p className="text-[11px] text-[var(--lm-subtle)] mt-0.5">{t.user.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--lm-paper)] px-2.5 py-1 text-[10px] font-bold text-[var(--lm-muted)] border border-[var(--lm-line)] group-hover:border-[var(--lm-teal)] transition-colors shadow-sm">
                    <Star size={10} className="text-[var(--lm-amber)] fill-[var(--lm-amber)]" /> {t.status}
                  </span>
                </div>
              </div>
            ))}
            {topTeachers.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[13px] font-bold text-[var(--lm-ink)]">No teachers available</p>
                <p className="text-[11px] text-[var(--lm-subtle)] mt-1">Once teachers are rated, they will appear here.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lm-panel overflow-hidden">
          <div className="border-b border-[var(--lm-line)] px-6 py-5 bg-[var(--lm-paper-muted)]">
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--lm-ink-strong)]">Language Distribution</h2>
            <p className="mt-1 text-[11px] text-[var(--lm-muted)]">Active languages and their total published courses.</p>
          </div>
          <div className="p-2">
            {popularLangs.map((l) => (
              <div key={l.id} className="flex items-center justify-between p-4 hover:bg-[var(--lm-hover)] rounded-lg transition-colors border-b border-[var(--lm-line)] last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-xl drop-shadow-sm">{l.flagEmoji}</span>
                  <span className="text-[13px] font-bold text-[var(--lm-ink)]">{l.name}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-1.5 w-20 bg-[var(--lm-line)] rounded-full overflow-hidden">
                    <div className="h-full bg-[var(--lm-teal)] rounded-full transition-all duration-1000" style={{ width: `${Math.min((l._count.courses / 10) * 100, 100)}%` }} />
                  </div>
                  <span className="text-[11px] font-semibold text-[var(--lm-muted)] w-14 text-right">{l._count.courses} courses</span>
                </div>
              </div>
            ))}
            {popularLangs.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[13px] font-bold text-[var(--lm-ink)]">No languages configured</p>
                <p className="text-[11px] text-[var(--lm-subtle)] mt-1">Add languages to see their distribution here.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

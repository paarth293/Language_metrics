import { db } from "@repo/database";
import { log } from "@repo/logger";
import { requireAdmin } from "@/lib/guards";
import { AlertTriangle, ArrowDownToLine, TrendingUp, Users, BookOpen, GraduationCap, XCircle, Star, DollarSign } from "lucide-react";

export const dynamic = 'force-dynamic';

function inr(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

interface TopTeacherRow {
  userId: string;
  name: string;
  status: string;
  user: { email: string } | null;
}

interface PopularLanguageRow {
  id: string;
  name: string;
  flagEmoji: string | null;
  _count: { courses: number } | null;
}

export default async function AnalyticsPage() {
  await requireAdmin();

  let loadError = false;
  let completed: number | null = null;
  let cancelled: number | null = null;
  let totalRevenuePaise: number | null = null;
  let newStudents: number | null = null;
  let students: number | null = null;
  let teachers: number | null = null;
  let activeCourses: number | null = null;
  let avgTeacherRating: number | null = null;
  let topTeachers: TopTeacherRow[] = [];
  let popularLangs: PopularLanguageRow[] = [];

  try {
    completed = await db.classSession.count({ where: { status: "COMPLETED" } });
    cancelled = await db.booking.count({ where: { status: "CANCELLED" } });
    const totalRev = await db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } });
    totalRevenuePaise = totalRev._sum.amount ?? 0;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    newStudents = await db.studentProfile.count({ where: { user: { createdAt: { gte: thirtyDaysAgo } } } });
    students = await db.studentProfile.count();
    teachers = await db.teacherProfile.count();
    activeCourses = await db.course.count({ where: { published: true } });

    const avgRating = await db.review.aggregate({ _avg: { rating: true } });
    avgTeacherRating = avgRating._avg.rating ?? 0;

    topTeachers = await db.teacherProfile.findMany({
      orderBy: { reviews: { _count: "desc" } },
      take: 5,
      select: {
        userId: true,
        name: true,
        status: true,
        user: {
          select: { email: true },
        },
      },
    });

    popularLangs = await db.language.findMany({
      where: { status: "ACTIVE" },
      include: { _count: { select: { courses: true } } },
      orderBy: { name: "asc" },
    });
  } catch (error) {
    loadError = true;
    log.error("[analytics] Failed to load analytics data", { error });
  }

  const metrics = [
    { label: "Total Revenue", value: totalRevenuePaise !== null ? inr(totalRevenuePaise) : "—", icon: DollarSign, color: "text-green-600 dark:text-green-400", bg: "bg-green-500/10" },
    { label: "Classes Completed", value: completed !== null ? completed.toLocaleString("en-IN") : "—", icon: TrendingUp, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { label: "Cancellations", value: cancelled !== null ? cancelled.toLocaleString("en-IN") : "—", icon: XCircle, color: "text-red-600 dark:text-red-400", bg: "bg-red-500/10" },
    { label: "Active Courses", value: activeCourses !== null ? activeCourses.toLocaleString("en-IN") : "—", icon: BookOpen, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-500/10" },
    { label: "Total Students", value: students !== null ? students.toLocaleString("en-IN") : "—", icon: GraduationCap, color: "text-[var(--lm-teal-deep)]", bg: "bg-[var(--lm-teal-soft)]" },
    { label: "New Students (30d)", value: newStudents !== null ? newStudents.toLocaleString("en-IN") : "—", icon: Users, color: "text-[var(--lm-teal-deep)]", bg: "bg-[var(--lm-teal-soft)]" },
    { label: "Total Teachers", value: teachers !== null ? teachers.toLocaleString("en-IN") : "—", icon: Users, color: "text-[var(--lm-amber)]", bg: "bg-[var(--lm-amber-soft)]" },
    { label: "Avg Teacher Rating", value: avgTeacherRating !== null ? (Math.round(avgTeacherRating * 10) / 10).toFixed(1) : "—", icon: Star, color: "text-[var(--lm-amber)]", bg: "bg-[var(--lm-amber-soft)]" },
  ];

  return (
    <div className="mx-auto max-w-[1230px] px-6 pb-4 pt-2 max-[900px]:px-5 max-[640px]:px-4">
      <div className="flex flex-col gap-3 mb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-[var(--lm-subtle)]">
              <span>Overview</span><span aria-hidden="true">/</span><span className="text-[var(--lm-muted)]">Reports & Analytics</span>
            </div>
            <h1 className="lm-page-title">Reports & Analytics</h1>
            <p className="lm-body-copy mt-1">Revenue, teacher, student, language, and operations insights.</p>
          </div>
          <button className="lm-button-secondary min-h-9 px-4 text-[12px] flex items-center gap-2">
            <ArrowDownToLine size={14} /> Export Report
          </button>
        </div>
      </div>

      {loadError && (
        <div
          role="alert"
          className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--lm-red)]/30 bg-[var(--lm-red-soft)] px-4 py-3 text-[13px] text-[var(--lm-ink-strong)]"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--lm-red)]" aria-hidden="true" />
          <div>
            <p className="font-semibold">Unable to load analytics data</p>
            <p className="mt-0.5 text-[12px] text-[var(--lm-muted)]">
              A database error prevented analytics metrics from loading. Please refresh the page or try again shortly.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
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
          <div className="border-b border-[var(--lm-line)] px-5 py-4 bg-[var(--lm-paper-muted)]">
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
                    <p className="text-[11px] text-[var(--lm-subtle)] mt-0.5">{t.user?.email ?? "—"}</p>
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
                <p className="text-[13px] font-bold text-[var(--lm-ink)]">
                  {loadError ? "Teacher rankings unavailable" : "No teachers available"}
                </p>
                <p className="text-[11px] text-[var(--lm-subtle)] mt-1">
                  {loadError ? "Data could not be loaded. Please try refreshing." : "Once teachers are rated, they will appear here."}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="lm-panel overflow-hidden">
          <div className="border-b border-[var(--lm-line)] px-5 py-4 bg-[var(--lm-paper-muted)]">
            <h2 className="text-[15px] font-bold tracking-tight text-[var(--lm-ink-strong)]">Language Distribution</h2>
            <p className="mt-1 text-[11px] text-[var(--lm-muted)]">Active languages and their total published courses.</p>
          </div>
          <div className="p-2">
            {popularLangs.map((l) => {
              const courseCount = l._count?.courses ?? 0;
              return (
                <div key={l.id} className="flex items-center justify-between p-4 hover:bg-[var(--lm-hover)] rounded-lg transition-colors border-b border-[var(--lm-line)] last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="text-xl drop-shadow-sm">{l.flagEmoji ?? "🌐"}</span>
                    <span className="text-[13px] font-bold text-[var(--lm-ink)]">{l.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 w-20 bg-[var(--lm-line)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--lm-teal)] rounded-full transition-all duration-1000" style={{ width: `${Math.min((courseCount / 10) * 100, 100)}%` }} />
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--lm-muted)] w-14 text-right">{courseCount} courses</span>
                  </div>
                </div>
              );
            })}
            {popularLangs.length === 0 && (
              <div className="py-12 text-center">
                <p className="text-[13px] font-bold text-[var(--lm-ink)]">
                  {loadError ? "Language distribution unavailable" : "No languages configured"}
                </p>
                <p className="text-[11px] text-[var(--lm-subtle)] mt-1">
                  {loadError ? "Data could not be loaded. Please try refreshing." : "Add languages to see their distribution here."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

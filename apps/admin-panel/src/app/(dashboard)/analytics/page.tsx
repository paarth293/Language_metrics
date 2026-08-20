import { db } from "@repo/database";
import { requireAdmin } from "@/lib/guards";

export const dynamic = 'force-dynamic';

function inr(paise: number): string {
  return "₹" + (paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

export default async function AnalyticsPage() {
  await requireAdmin();
  const [completed, cancelled, totalRev, newStudents, students, teachers] = await Promise.all([
    db.classSession.count({ where: { status: "COMPLETED" } }),
    db.booking.count({ where: { status: "CANCELLED" } }),
    db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    db.studentProfile.count({ where: { user: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } } } }),
    db.studentProfile.count(),
    db.teacherProfile.count(),
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

  const cardStyle = { background: "var(--lm-surface)", border: "1px solid var(--lm-border2)" };
  const metrics = [
    { label: "Revenue", value: inr(totalRev._sum.amount ?? 0) },
    { label: "Classes Completed", value: completed.toLocaleString("en-IN") },
    { label: "Cancellations", value: cancelled.toLocaleString("en-IN") },
    { label: "New Students (30d)", value: newStudents.toLocaleString("en-IN") },
    { label: "Total Students", value: students.toLocaleString("en-IN") },
    { label: "Total Teachers", value: teachers.toLocaleString("en-IN") },
    { label: "Avg Teacher Rating", value: Math.round((avgRating._avg.rating ?? 0) * 10) / 10 + "" },
  ];

  return (
    <div className="p-7 space-y-6 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p style={{ color: "var(--lm-text-muted)" }} className="text-[13px] mt-1">Revenue, teacher, student, language, and operations insights.</p>
        </div>
        <button style={{ border: "1px solid var(--lm-border2)", color: "var(--lm-text-muted)" }} className="px-4 py-2 rounded-lg text-[13px] font-semibold hover:bg-gray-700 hover:text-white transition-colors">
          Export Report
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} style={cardStyle} className="p-5 rounded-xl">
            <p style={{ color: "var(--lm-text-muted)" }} className="text-[11px] font-bold tracking-widest mb-1">{m.label}</p>
            <h3 style={{ color: "var(--lm-text)" }} className="text-2xl font-bold tracking-tight">{m.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div style={cardStyle} className="rounded-xl p-6">
          <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold mb-4">Top Teachers</h2>
          <div className="space-y-3">
            {topTeachers.map((t, i) => (
              <div key={t.userId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span style={{ color: "var(--lm-accent)" }} className="text-[13px] font-bold w-4">{i + 1}</span>
                  <span style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{t.name}</span>
                </div>
                <span style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={cardStyle} className="rounded-xl p-6">
          <h2 style={{ color: "var(--lm-text)" }} className="text-[16px] font-bold mb-4">Languages & Courses</h2>
          <div className="space-y-3">
            {popularLangs.map((l) => (
              <div key={l.id} className="flex items-center justify-between">
                <span style={{ color: "var(--lm-text)" }} className="text-[13px] font-medium">{l.flagEmoji} {l.name}</span>
                <span style={{ color: "var(--lm-text-muted)" }} className="text-[13px]">{l._count.courses} courses</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

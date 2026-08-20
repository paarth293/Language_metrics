import { db } from "@repo/database";

// Aggregations used by the dashboard and analytics pages. Money values are in
// paise throughout the schema; consumers format for display.

export async function getDashboardStats() {
  const [
    totalStudents,
    totalTeachers,
    activeTeachers,
    pendingApprovals,
    totalRevenue,
    commissionEarned,
    pendingPayouts,
    activeCourses,
    completedClasses,
    todayClasses,
    newRegistrations,
    openComplaints,
    cancelledBookings,
  ] = await Promise.all([
    db.studentProfile.count(),
    db.teacherProfile.count(),
    db.teacherProfile.count({ where: { status: "APPROVED" } }),
    db.teacherProfile.count({ where: { status: "PENDING" } }),
    db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { status: "SUCCESS" }, _sum: { amount: true } }),
    db.payout.aggregate({ where: { status: { in: ["PENDING", "PROCESSING"] } }, _sum: { amount: true } }),
    db.course.count({ where: { published: true } }),
    db.classSession.count({ where: { status: "COMPLETED" } }),
    db.classSession.count({
      where: {
        scheduledStart: { gte: startOfDay(), lt: endOfDay() },
        status: "SCHEDULED",
      },
    }),
    db.user.count({
      where: { createdAt: { gte: last30Days() } },
    }),
    db.complaint.count({ where: { status: { in: ["NEW", "INVESTIGATING", "ACTION_REQUIRED"] } } }),
    db.booking.count({ where: { status: "CANCELLED" } }),
  ]);

  const avgRating = await db.review.aggregate({ _avg: { rating: true } });

  return {
    totalStudents,
    totalTeachers,
    activeTeachers,
    pendingApprovals,
    totalRevenue: totalRevenue._sum.amount ?? 0,
    commissionEarned: commissionEarned._sum.amount ?? 0,
    pendingPayouts: pendingPayouts._sum.amount ?? 0,
    activeCourses,
    completedClasses,
    todayClasses,
    newRegistrations,
    openComplaints,
    cancelledBookings,
    avgRating: Math.round((avgRating._avg.rating ?? 0) * 10) / 10,
  };
}

export async function getPopularLanguages() {
  // Placeholder: languages are joined via Course -> booking flows not yet
  // linked in this build. Returns language list with course counts.
  const langs = await db.language.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, name: true, _count: { select: { courses: true } } },
    orderBy: { name: "asc" },
  });
  return langs.map((l) => ({ name: l.name, courseCount: l._count.courses }));
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfDay(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function last30Days(): Date {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
}

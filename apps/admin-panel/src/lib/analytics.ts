import { db } from "@repo/database";
import { unstable_cache } from "next/cache";

// Aggregations used by the dashboard and analytics pages. Money values are in
// paise throughout the schema; consumers format for display.

export const getDashboardStats = unstable_cache(async () => {
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
}, ["dashboard-stats"], { tags: ["dashboard-stats"], revalidate: 60 });

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

export async function getLatestPendingTeachers() {
  return await db.teacherProfile.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      userId: true,
      name: true,
      language: true,
      status: true,
      createdAt: true,
      user: {
        select: { email: true },
      },
    },
  });
}

export async function getRevenueTrend() {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
  
  const payments = await db.payment.findMany({
    where: { 
      status: "SUCCESS",
      createdAt: { gte: tenDaysAgo }
    },
    select: { amount: true, createdAt: true }
  });

  const grouped = new Map<string, number>();
  for (const p of payments) {
    const day = p.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    grouped.set(day, (grouped.get(day) || 0) + p.amount);
  }

  const result = [];
  for (let i = 9; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const label = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
    const amount = grouped.get(label) || 0;
    
    // Convert paise to thousands for chart
    const currentThousands = amount > 0 ? Math.max(Math.round(amount / 100_000), 1) : 0;
    
    result.push({
      label,
      current: currentThousands,
      previous: 0, // Not comparing previous period for now
    });
  }

  return result;
}

export async function checkDatabaseHealth() {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}


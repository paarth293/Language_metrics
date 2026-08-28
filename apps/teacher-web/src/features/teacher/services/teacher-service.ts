import { db } from "@/lib/db";
import type { VerificationStatus } from "@repo/database";

export class TeacherService {
  // ── Profile ──────────────────────────────────────────────────────────────

  static async getProfileByUserId(userId: string) {
    const profile = await db.teacherProfile.findUnique({
      where: { userId },
      include: {
        user: { select: { id: true, email: true, createdAt: true } },
        documents: { orderBy: { createdAt: "desc" } },
      },
    });
    if (!profile) return null;
    return { ...profile, user: { ...profile.user, name: profile.name } };
  }

  static async getProfileWithSettings(userId: string) {
    return db.teacherProfile.findUnique({
      where: { userId },
      include: { rates: true, availability: true, documents: true },
    });
  }

  static async updateProfile(userId: string, data: { bio?: string; avatarUrl?: string; demoVideoUrl?: string }) {
    return db.teacherProfile.update({ where: { userId }, data });
  }

  // ── Rates & Availability ─────────────────────────────────────────────────

  static async updateRates(teacherId: string, hourlyRate: number, courseRate: number) {
    await db.$transaction([
      db.teacherRate.upsert({
        where: { teacherId_type: { teacherId, type: "HOURLY" } },
        update: { amount: hourlyRate },
        create: { teacherId, type: "HOURLY", amount: hourlyRate },
      }),
      db.teacherRate.upsert({
        where: { teacherId_type: { teacherId, type: "COURSE" } },
        update: { amount: courseRate },
        create: { teacherId, type: "COURSE", amount: courseRate },
      }),
    ]);
  }

  static async updateAvailability(teacherId: string, slots: { dayOfWeek: number; startTime: string; endTime: string }[]) {
    await db.$transaction(async (tx) => {
      await tx.availabilitySlot.deleteMany({ where: { teacherId } });
      if (slots.length > 0) {
        await tx.availabilitySlot.createMany({
          data: slots.map((s) => ({ teacherId, ...s })),
        });
      }
    });
  }

  // ── Documents ────────────────────────────────────────────────────────────

  static async getDocuments(teacherId: string) {
    return db.teacherDocument.findMany({
      where: { teacherId },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Dashboard ────────────────────────────────────────────────────────────

  static async getDashboardData(teacherId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    // Run all queries in parallel
    const [
      classesTaughtCount,
      activeStudentsResult,
      reviews,
      upcomingTodayClasses,
      thisWeekClasses,
      pendingBookings,
      profile,
      recentBookings,
      monthlyEarnings,
      unreadNotifications,
      upcomingInterview,
    ] = await Promise.all([
      // Completed classes count
      db.booking.count({ where: { teacherId, status: "COMPLETED" } }),

      // Active unique students
      db.booking.groupBy({
        by: ["studentId"],
        where: { teacherId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      }),

      // Reviews aggregate
      db.review.aggregate({
        where: { teacherId },
        _avg: { rating: true },
        _count: { rating: true },
      }),

      // Today's upcoming classes
      db.booking.findMany({
        where: {
          teacherId,
          status: "CONFIRMED",
          sessions: { some: { scheduledStart: { gte: todayStart, lt: todayEnd }, status: { in: ["SCHEDULED", "ONGOING"] } } },
        },
        include: {
          student: { select: { userId: true, name: true, avatarUrl: true, proficiencyLevel: true } },
          sessions: {
            where: { scheduledStart: { gte: todayStart, lt: todayEnd } },
            orderBy: { scheduledStart: "asc" },
          },
        },
      }),

      // This week's classes (for weekly chart)
      db.booking.findMany({
        where: {
          teacherId,
          status: { in: ["CONFIRMED", "COMPLETED"] },
          sessions: { some: { scheduledStart: { gte: weekStart, lt: weekEnd } } },
        },
        include: {
          sessions: {
            where: { scheduledStart: { gte: weekStart, lt: weekEnd } },
            select: { scheduledStart: true, status: true },
          },
        },
      }),

      // Pending bookings awaiting teacher action
      db.booking.count({ where: { teacherId, status: "PENDING" } }),

      // Profile status
      db.teacherProfile.findUnique({
        where: { userId: teacherId },
        select: {
          status: true,
          name: true,
          language: true,
          languages: true,
          avatarUrl: true,
          bio: true,
          experienceLevel: true,
        },
      }),

      // Recent bookings (last 5)
      db.booking.findMany({
        where: { teacherId },
        include: {
          student: { select: { name: true, avatarUrl: true } },
          sessions: { orderBy: { scheduledStart: "desc" }, take: 1 },
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),

      // Monthly earnings
      db.booking.aggregate({
        where: {
          teacherId,
          status: "COMPLETED",
          createdAt: { gte: monthStart, lte: monthEnd },
        },
        _sum: { teacherEarnings: true },
        _count: { _all: true },
      }),

      // Unread notifications count
      db.notification.count({ where: { userId: teacherId, isRead: false } }),

      // Upcoming interview (if any)
      db.interview.findFirst({
        where: { teacherId, status: "SCHEDULED", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
      }),
    ]);

    const activeStudentsCount = activeStudentsResult.length;

    // Process today's classes
    const upcomingClasses = upcomingTodayClasses
      .map((booking) => {
        const session = booking.sessions[0];
        const nowMs = Date.now();
        const startMs = session ? new Date(session.scheduledStart).getTime() : 0;
        const diffMin = (startMs - nowMs) / 60000;
        const isStartingSoon = diffMin >= 0 && diffMin <= 10;
        const isOngoing = session?.status === "ONGOING";

        return {
          id: booking.id,
          sessionId: session?.id,
          type: booking.type,
          student: booking.student.name,
          avatar: booking.student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(booking.student.name)}`,
          level: booking.student.proficiencyLevel,
          date: "Today",
          time: session
            ? `${new Date(session.scheduledStart).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} – ${new Date(session.scheduledEnd).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "TBD",
          status: isOngoing ? "ongoing" : isStartingSoon ? "starts_soon" : "confirmed",
          scheduledStart: session?.scheduledStart,
        };
      })
      .sort((a, b) => {
        if (!a.scheduledStart || !b.scheduledStart) return 0;
        return new Date(a.scheduledStart).getTime() - new Date(b.scheduledStart).getTime();
      });

    // Process weekly data for chart
    const weeklyData: { day: string; count: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dayStr = dayNames[d.getDay()];
      const count = thisWeekClasses.reduce((acc, b) => {
        return acc + b.sessions.filter((s) => new Date(s.scheduledStart).getDay() === d.getDay()).length;
      }, 0);
      weeklyData.push({ day: dayStr, count });
    }

    // Process recent activity
    const recentActivity = recentBookings.map((b) => ({
      id: b.id,
      student: b.student.name,
      avatar: b.student.avatarUrl,
      type: b.type,
      status: b.status,
      amount: b.teacherEarnings,
      date: b.createdAt,
      lastSessionDate: b.sessions[0]?.scheduledStart,
    }));

    return {
      stats: {
        classesTaught: classesTaughtCount,
        activeStudents: activeStudentsCount,
        averageRating: reviews._avg.rating || 0,
        totalReviews: reviews._count.rating || 0,
        pendingBookings,
        monthlyEarnings: monthlyEarnings._sum.teacherEarnings || 0,
        monthlyClasses: monthlyEarnings._count._all,
        unreadNotifications,
      },
      upcomingClasses,
      weeklySchedule: weeklyData,
      recentActivity,
      profileStatus: profile?.status || "PENDING",
      profileName: profile?.name || "Teacher",
      profileIncomplete: !profile?.bio || !profile?.avatarUrl,
      upcomingInterview: upcomingInterview
        ? {
            date: upcomingInterview.scheduledAt,
            meetingLink: upcomingInterview.meetingLink,
          }
        : null,
    };
  }

  // ── Students ─────────────────────────────────────────────────────────────

  static async getStudents(teacherId: string) {
    const bookings = await db.booking.findMany({
      where: { teacherId, status: { in: ["CONFIRMED", "COMPLETED"] } },
      include: {
        student: true,
        sessions: { orderBy: { scheduledStart: "desc" } },
        review: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Group by student
    const studentMap = new Map<string, Record<string, unknown>>();
    for (const booking of bookings) {
      const sid = booking.studentId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          id: booking.student.userId,
          name: booking.student.name,
          avatar: booking.student.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(booking.student.name)}`,
          level: booking.student.proficiencyLevel,
          totalClasses: 0,
          completedClasses: 0,
          upcomingClasses: 0,
          totalSpent: 0,
          lastClassDate: null as Date | null,
          rating: null as number | null,
          joinedAt: booking.student.userId,
        });
      }
      const s = studentMap.get(sid);
      s.totalClasses += booking.sessions.length;
      s.completedClasses += booking.sessions.filter((x) => x.status === "COMPLETED").length;
      s.upcomingClasses += booking.sessions.filter((x) => x.status === "SCHEDULED").length;
      s.totalSpent += booking.teacherEarnings;
      if (booking.sessions[0]?.scheduledStart) {
        const d = new Date(booking.sessions[0].scheduledStart);
        if (!s.lastClassDate || d > s.lastClassDate) s.lastClassDate = d;
      }
      if (booking.review) s.rating = booking.review.rating;
    }

    return Array.from(studentMap.values()).sort(
      (a, b) => (b.lastClassDate?.getTime() || 0) - (a.lastClassDate?.getTime() || 0)
    );
  }

  // ── Earnings ─────────────────────────────────────────────────────────────

  static async getEarnings(teacherId: string) {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allEarnings, monthlyPayouts, thisMonthEarnings, todayEarnings, recentTransactions] =
      await Promise.all([
        // Total lifetime earnings
        db.booking.aggregate({
          where: { teacherId, status: "COMPLETED" },
          _sum: { teacherEarnings: true, commissionAmount: true, amountPaid: true },
          _count: { _all: true },
        }),

        // Payout history
        db.payout.findMany({
          where: { teacherId },
          orderBy: { createdAt: "desc" },
          take: 12,
        }),

        // This month's earnings
        db.booking.aggregate({
          where: { teacherId, status: "COMPLETED", createdAt: { gte: monthStart } },
          _sum: { teacherEarnings: true },
          _count: { _all: true },
        }),

        // Today's earnings
        db.booking.aggregate({
          where: { teacherId, status: "COMPLETED", createdAt: { gte: todayStart } },
          _sum: { teacherEarnings: true },
          _count: { _all: true },
        }),

        // Recent coin transactions
        db.coinTransaction.findMany({
          where: { userId: teacherId },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      ]);

    // Calculate weekly breakdown
    const weekEarnings = await db.booking.aggregate({
      where: { teacherId, status: "COMPLETED", createdAt: { gte: weekStart } },
      _sum: { teacherEarnings: true },
      _count: { _all: true },
    });

    return {
      summary: {
        totalEarnings: allEarnings._sum.teacherEarnings || 0,
        totalCommission: allEarnings._sum.commissionAmount || 0,
        totalStudentPayments: allEarnings._sum.amountPaid || 0,
        totalClasses: allEarnings._count._all,
        thisMonth: {
          earnings: thisMonthEarnings._sum.teacherEarnings || 0,
          classes: thisMonthEarnings._count._all,
        },
        thisWeek: {
          earnings: weekEarnings._sum.teacherEarnings || 0,
          classes: weekEarnings._count._all,
        },
        today: {
          earnings: todayEarnings._sum.teacherEarnings || 0,
          classes: todayEarnings._count._all,
        },
      },
      payouts: monthlyPayouts.map((p) => ({
        id: p.id,
        amount: p.amount,
        status: p.status,
        periodStart: p.periodStart,
        periodEnd: p.periodEnd,
        transactionRef: p.transactionRef,
        createdAt: p.createdAt,
      })),
      transactions: recentTransactions.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.type === "SPEND" ? -t.amount : t.amount,
        description: t.description,
        createdAt: t.createdAt,
      })),
    };
  }

  // ── Notifications ────────────────────────────────────────────────────────

  static async getNotifications(teacherId: string, limit = 50) {
    return db.notification.findMany({
      where: { userId: teacherId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  static async markNotificationRead(teacherId: string, notificationId: string) {
    return db.notification.updateMany({
      where: { id: notificationId, userId: teacherId },
      data: { isRead: true },
    });
  }

  static async markAllNotificationsRead(teacherId: string) {
    return db.notification.updateMany({
      where: { userId: teacherId, isRead: false },
      data: { isRead: true },
    });
  }

  // ── Admin helpers ────────────────────────────────────────────────────────

  static async findById(id: string) {
    return db.teacherProfile.findUnique({ where: { userId: id } });
  }

  static async listTeachersForAdmin(status?: VerificationStatus) {
    const teachers = await db.teacherProfile.findMany({
      where: status ? { status } : undefined,
      include: { user: { select: { id: true, email: true, createdAt: true } } },
      orderBy: { createdAt: "desc" },
    });

    const mappedTeachers = teachers.map((t) => ({
      ...t,
      user: { ...t.user, name: t.name },
    }));

    const counts = await db.teacherProfile.groupBy({
      by: ["status"],
      _count: { _all: true },
    });

    const summary: Record<string, number> = { PENDING: 0, APPROVED: 0, REJECTED: 0, INTERVIEW_SCHEDULED: 0, total: 0 };
    for (const c of counts) {
      summary[c.status] = c._count._all;
      summary.total += c._count._all;
    }

    return { teachers: mappedTeachers, summary };
  }

  static async updateVerificationStatus(id: string, status: VerificationStatus) {
    const profile = await db.teacherProfile.update({
      where: { userId: id },
      data: { status },
      include: { user: { select: { id: true, email: true, createdAt: true } } },
    });
    return { ...profile, user: { ...profile.user, name: profile.name } };
  }
}

export default TeacherService;

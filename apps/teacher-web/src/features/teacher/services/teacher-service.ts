import { db } from "@/lib/db";
import type { VerificationStatus } from "@repo/database";
import { currentOrNextSession, getJoinWindow } from "@repo/live-classes";

type DashboardSessionRow = {
  id: string;
  bookingId: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  bookingStatus: string;
  bookingType: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  proficiencyLevel: string;
};

type DashboardRow = {
  activeStudents: number;
  pendingBookings: number;
  classesTaught: number;
  averageRating: number;
  totalReviews: number;
  monthEarnings: number;
  availabilitySlots: number;
  profile: { name: string; status: string; avatarUrl: string | null; hasBio: boolean } | null;
  weekSessions: DashboardSessionRow[];
  upcoming: DashboardSessionRow[];
  recentBookings: Array<{
    id: string;
    status: string;
    type: string;
    amount: number;
    createdAt: string;
    name: string;
    avatarUrl: string | null;
  }>;
};

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
    const profile = await db.teacherProfile.findUnique({
      where: { userId },
      include: { rates: true, availability: true, documents: true, user: { select: { email: true } } },
    });
    if (!profile) return null;
    const { user, ...rest } = profile;
    return { ...rest, email: user.email };
  }

  static async updateProfile(userId: string, data: { bio?: string; avatarUrl?: string; demoVideoUrl?: string }) {
    return db.teacherProfile.update({ where: { userId }, data });
  }

  // ── Rates & Availability ─────────────────────────────────────────────────

  /**
   * `currency` is the currency `hourlyRate`/`courseRate` are denominated in
   * (paise of it, same as before — just no longer assumed to be INR paise).
   * Omitting it leaves each rate's existing currency untouched.
   */
  static async updateRates(teacherId: string, hourlyRate: number, courseRate: number, currency?: string) {
    const currencyData = currency ? { currency } : {};
    await db.$transaction([
      db.teacherRate.upsert({
        where: { teacherId_type: { teacherId, type: "HOURLY" } },
        update: { amount: hourlyRate, ...currencyData },
        create: { teacherId, type: "HOURLY", amount: hourlyRate, ...currencyData },
      }),
      db.teacherRate.upsert({
        where: { teacherId_type: { teacherId, type: "COURSE" } },
        update: { amount: courseRate, ...currencyData },
        create: { teacherId, type: "COURSE", amount: courseRate, ...currencyData },
      }),
    ]);
  }

  static async updateAvailability(
    teacherId: string,
    slots: { dayOfWeek: number; startTime: string; endTime: string }[],
    timeZone?: string
  ) {
    await db.$transaction(async (tx) => {
      // The slot times only mean something in the zone they were entered in.
      if (timeZone) {
        await tx.teacherProfile.update({ where: { userId: teacherId }, data: { timeZone } });
      }
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

  /**
   * Everything the teacher dashboard shows, in ONE SQL statement. The
   * database is reached through a single pooled connection, so a dozen Prisma
   * queries ran one after another (~14s); one round trip keeps it fast.
   * Week/month bounds come from the browser so "this week" matches the
   * teacher's own timezone.
   */
  static async getDashboardData(
    teacherId: string,
    range: { weekStart: Date; weekEnd: Date; monthStart: Date; monthEnd: Date }
  ) {
    // Timestamps are stored as UTC without a zone: compare against UTC wall
    // time, and tag outputs as UTC so the client parses them correctly.
    const [row] = await db.$queryRaw<DashboardRow[]>`
      WITH mine AS (
        SELECT b.id, b."studentId", b.status, b.type, b."teacherEarnings", b."createdAt"
          FROM "Booking" b
         WHERE b."teacherId" = ${teacherId}::uuid
      ),
      sessions AS (
        SELECT s.id, s."bookingId", s.status, s."scheduledStart", s."scheduledEnd",
               m.status AS "bookingStatus", m.type AS "bookingType",
               st."userId", st.name, st."avatarUrl", st."proficiencyLevel"
          FROM "ClassSession" s
          JOIN mine m ON m.id = s."bookingId"
          JOIN "StudentProfile" st ON st."userId" = m."studentId"
      )
      SELECT
        (SELECT COUNT(DISTINCT "studentId") FROM mine WHERE status IN ('CONFIRMED', 'COMPLETED'))::int AS "activeStudents",
        (SELECT COUNT(*) FROM mine WHERE status = 'PENDING')::int AS "pendingBookings",
        (SELECT COUNT(*) FROM sessions WHERE status = 'COMPLETED')::int AS "classesTaught",
        (SELECT COALESCE(AVG(rating), 0) FROM "Review" WHERE "teacherId" = ${teacherId}::uuid)::float AS "averageRating",
        (SELECT COUNT(*) FROM "Review" WHERE "teacherId" = ${teacherId}::uuid)::int AS "totalReviews",
        (SELECT COALESCE(SUM("teacherEarnings"), 0) FROM mine
          WHERE status = 'COMPLETED'
            AND "createdAt" >= (${range.monthStart}::timestamptz AT TIME ZONE 'UTC')
            AND "createdAt" <  (${range.monthEnd}::timestamptz AT TIME ZONE 'UTC'))::int AS "monthEarnings",
        (SELECT COUNT(*) FROM "AvailabilitySlot" WHERE "teacherId" = ${teacherId}::uuid)::int AS "availabilitySlots",
        (SELECT json_build_object('name', name, 'status', status, 'avatarUrl', "avatarUrl", 'hasBio', COALESCE(bio, '') <> '')
           FROM "TeacherProfile" WHERE "userId" = ${teacherId}::uuid) AS "profile",
        (SELECT COALESCE(json_agg(x ORDER BY x."scheduledStart"), '[]'::json) FROM (
           SELECT id, "bookingId", status, "scheduledStart" AT TIME ZONE 'UTC' AS "scheduledStart", "scheduledEnd" AT TIME ZONE 'UTC' AS "scheduledEnd",
                  "bookingStatus", "bookingType", "userId", name, "avatarUrl", "proficiencyLevel"
             FROM sessions
            WHERE "scheduledStart" >= (${range.weekStart}::timestamptz AT TIME ZONE 'UTC')
              AND "scheduledStart" <  (${range.weekEnd}::timestamptz AT TIME ZONE 'UTC')
        ) x) AS "weekSessions",
        (SELECT COALESCE(json_agg(x ORDER BY x."scheduledStart"), '[]'::json) FROM (
           SELECT id, "bookingId", status, "scheduledStart" AT TIME ZONE 'UTC' AS "scheduledStart", "scheduledEnd" AT TIME ZONE 'UTC' AS "scheduledEnd",
                  "bookingStatus", "bookingType", "userId", name, "avatarUrl", "proficiencyLevel"
             FROM sessions
            WHERE status IN ('SCHEDULED', 'ONGOING') AND "bookingStatus" <> 'CANCELLED'
              AND "scheduledEnd" > (NOW() AT TIME ZONE 'UTC') - INTERVAL '2 hours'
            ORDER BY "scheduledStart" LIMIT 5
        ) x) AS "upcoming",
        (SELECT COALESCE(json_agg(x ORDER BY x."createdAt" DESC), '[]'::json) FROM (
           SELECT m.id, m.status, m.type, m."teacherEarnings" AS amount, m."createdAt" AT TIME ZONE 'UTC' AS "createdAt",
                  st.name, st."avatarUrl"
             FROM mine m JOIN "StudentProfile" st ON st."userId" = m."studentId"
            ORDER BY m."createdAt" DESC LIMIT 5
        ) x) AS "recentBookings"
    `;

    const toSession = (s: DashboardSessionRow) => {
      const window = getJoinWindow({ scheduledStart: new Date(s.scheduledStart), scheduledEnd: new Date(s.scheduledEnd) });
      return {
        id: s.id,
        status: s.status,
        scheduledStart: s.scheduledStart,
        scheduledEnd: s.scheduledEnd,
        joinOpensAt: window.opensAt.toISOString(),
        joinClosesAt: window.closesAt.toISOString(),
        booking: { id: s.bookingId, status: s.bookingStatus, type: s.bookingType },
        student: { userId: s.userId, name: s.name, avatarUrl: s.avatarUrl, proficiencyLevel: s.proficiencyLevel },
      };
    };

    const next = currentOrNextSession(
      row.upcoming.map((s) => ({ ...s, scheduledStart: new Date(s.scheduledStart), scheduledEnd: new Date(s.scheduledEnd) }))
    );
    const nextRow = next ? row.upcoming.find((s) => s.id === next.id) : undefined;

    return {
      profile: {
        name: row.profile?.name ?? "Teacher",
        status: row.profile?.status ?? "PENDING",
        hasAvatar: !!row.profile?.avatarUrl,
        hasBio: !!row.profile?.hasBio,
      },
      stats: {
        activeStudents: row.activeStudents,
        pendingBookings: row.pendingBookings,
        classesTaught: row.classesTaught,
        averageRating: row.averageRating,
        totalReviews: row.totalReviews,
        monthEarnings: row.monthEarnings,
        availabilitySlots: row.availabilitySlots,
      },
      weekSessions: row.weekSessions.map(toSession),
      nextSession: nextRow ? toSession(nextRow) : null,
      recentBookings: row.recentBookings,
    };
  }

  // ── Students ─────────────────────────────────────────────────────────────

  static async getStudents(teacherId: string) {
    const now = new Date();
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const studentMap = new Map<string, any>();
    for (const booking of bookings) {
      const sid = booking.studentId;
      if (!studentMap.has(sid)) {
        studentMap.set(sid, {
          id: booking.student.userId,
          name: booking.student.name,
          avatar: booking.student.avatarUrl,
          level: booking.student.proficiencyLevel,
          totalClasses: 0,
          completedClasses: 0,
          upcomingClasses: 0,
          totalSpent: 0,
          lastClassDate: null as Date | null,
          nextClassDate: null as Date | null,
          rating: null as number | null,
          reviewComment: null as string | null,
          joinedAt: booking.student.userId,
        });
      }
      const s = studentMap.get(sid);
      s.totalClasses += booking.sessions.length;
      s.completedClasses += booking.sessions.filter((x) => x.status === "COMPLETED").length;
      for (const x of booking.sessions) {
        if (x.status === "CANCELLED") continue;
        const d = new Date(x.scheduledStart);
        if (d <= now) {
          if (!s.lastClassDate || d > s.lastClassDate) s.lastClassDate = d;
        } else if (x.status === "SCHEDULED") {
          s.upcomingClasses += 1;
          if (!s.nextClassDate || d < s.nextClassDate) s.nextClassDate = d;
        }
      }
      s.totalSpent += booking.teacherEarnings;
      if (booking.review) {
        s.rating = booking.review.rating;
        s.reviewComment = booking.review.comment;
      }
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
        amount: t.amount,
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

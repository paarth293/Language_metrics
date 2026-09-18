import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/dashboard
 * Returns comprehensive dashboard data for the authenticated student.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const now = new Date();

    // Default practice series
    const defaultPracticeSeries = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - (i * 7));
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay() + 1); // Monday start
      defaultPracticeSeries.push({
        weekStart: d.toISOString(),
        hours: 0,
        classes: 0,
      });
    }

    // Default stats
    const defaultStats = {
      totalClasses: 0,
      totalHours: 0,
      uniqueTeachers: 0,
      coinBalance: 0,
      monthlyClasses: 0,
      streak: 0,
      hoursThisWeek: 0,
      hoursLastWeek: 0,
      classesThisMonth: 0,
      classesLastMonth: 0,
      bestStreak: 0,
      streakDays: [false, false, false, false, false, false, false],
    };

    // Fetch student profile — gracefully handle missing profile
    const profile = await db.studentProfile.findUnique({
      where: { userId },
      select: {
        name: true,
        languageToLearn: true,
        proficiencyLevel: true,
        avatarUrl: true,
      },
    });

    // If no profile yet, return empty defaults so the dashboard still renders
    if (!profile) {
      return NextResponse.json({
        profile: {
          name: "Student",
          languageToLearn: "",
          proficiencyLevel: "",
          avatarUrl: null,
        },
        stats: defaultStats,
        practiceSeries: defaultPracticeSeries,
        teachers: [],
        upcomingClasses: [],
        recentActivity: [],
      });
    }

    // Fetch bookings with sessions
    const bookings = await db.booking.findMany({
      where: { studentId: userId },
      include: {
        teacher: {
          select: {
            name: true,
            avatarUrl: true,
            language: true,
            languages: true,
          },
        },
        sessions: {
          select: {
            id: true,
            scheduledStart: true,
            scheduledEnd: true,
            actualStart: true,
            actualEnd: true,
            status: true,
            recordingUrl: true,
          },
          orderBy: { scheduledStart: "asc" },
        },
        review: {
          select: { rating: true, comment: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Calculate base stats
    const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
    const totalClasses = completedBookings.reduce(
      (acc, b) => acc + b.sessions.filter((s) => s.status === "COMPLETED").length,
      0
    );
    const totalHours = totalClasses * 0.5;
    const uniqueTeachers = new Set(bookings.map((b) => b.teacherId)).size;

    // 8-week practice momentum logic
    const practiceSeries = [...defaultPracticeSeries].map(p => ({ ...p }));
    completedBookings.forEach(b => {
      b.sessions.filter(s => s.status === "COMPLETED" && s.actualEnd).forEach(s => {
        const d = new Date(s.actualEnd!);
        for (let i = 0; i < 8; i++) {
          const wStart = new Date(practiceSeries[i].weekStart);
          const nextWeek = new Date(wStart);
          nextWeek.setDate(nextWeek.getDate() + 7);
          if (d >= wStart && d < nextWeek) {
            practiceSeries[i].classes += 1;
            practiceSeries[i].hours += 0.5;
          }
        }
      });
    });

    const hoursThisWeek = practiceSeries[7].hours;
    const hoursLastWeek = practiceSeries[6].hours;

    // Streak calculation
    const completedDays = new Set(
      completedBookings
        .flatMap(b => b.sessions)
        .filter(s => s.status === "COMPLETED" && s.actualEnd)
        .map(s => {
           const d = new Date(s.actualEnd!);
           return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        })
    );
    
    // Current streak
    let todayDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    let yesterdayDate = new Date(now);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    let yesterdayDateStr = `${yesterdayDate.getFullYear()}-${String(yesterdayDate.getMonth() + 1).padStart(2, '0')}-${String(yesterdayDate.getDate()).padStart(2, '0')}`;

    let streak = 0;
    if (completedDays.has(todayDateStr) || completedDays.has(yesterdayDateStr)) {
        let checkDate = new Date(completedDays.has(todayDateStr) ? now : yesterdayDate);
        while (true) {
            let checkStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
            if (completedDays.has(checkStr)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
    }
    
    // Best streak
    let bestStreak = 0;
    let tempStreak = 0;
    let prevDate: Date | null = null;
    Array.from(completedDays).sort((a, b) => new Date(a).getTime() - new Date(b).getTime()).forEach(dateStr => {
        const currDate = new Date(dateStr);
        if (!prevDate) {
            tempStreak = 1;
        } else {
            const diffDays = Math.round((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays === 1) {
                tempStreak++;
            } else {
                if (tempStreak > bestStreak) bestStreak = tempStreak;
                tempStreak = 1;
            }
        }
        prevDate = currDate;
    });
    if (tempStreak > bestStreak) bestStreak = tempStreak;

    // streakDays boolean array (last 7 days, oldest first)
    const streakDays = [];
    for (let i = 6; i >= 0; i--) {
        let checkD = new Date(now);
        checkD.setDate(checkD.getDate() - i);
        let checkStr = `${checkD.getFullYear()}-${String(checkD.getMonth() + 1).padStart(2, '0')}-${String(checkD.getDate()).padStart(2, '0')}`;
        streakDays.push(completedDays.has(checkStr));
    }

    // Monthly classes
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
    
    const classesThisMonth = completedBookings.filter((b) => {
      const sessionDate = b.sessions.find((s) => s.status === "COMPLETED")?.actualEnd;
      if (!sessionDate) return false;
      return new Date(sessionDate) >= monthStart;
    }).length;

    const classesLastMonth = completedBookings.filter((b) => {
      const sessionDate = b.sessions.find((s) => s.status === "COMPLETED")?.actualEnd;
      if (!sessionDate) return false;
      const d = new Date(sessionDate);
      return d >= lastMonthStart && d <= lastMonthEnd;
    }).length;

    // Your teachers
    const teachersMap = new Map();
    completedBookings.forEach(b => {
       if (!teachersMap.has(b.teacherId)) {
           teachersMap.set(b.teacherId, {
               id: b.teacherId,
               name: b.teacher.name,
               avatar: b.teacher.avatarUrl,
               language: b.teacher.language || b.teacher.languages?.[0] || "Unknown",
               lastClassAt: b.createdAt.toISOString()
           });
       }
    });
    const teachers = Array.from(teachersMap.values()).slice(0, 4);

    // Upcoming classes (next 7 days)
    const upcomingBookings = bookings
      .filter((b) => {
        if (b.status !== "CONFIRMED") return false;
        const nextSession = b.sessions.find(
          (s) => s.status === "SCHEDULED" && new Date(s.scheduledStart) > now
        );
        return !!nextSession;
      })
      .slice(0, 5);

    // Recent activity
    const recentActivity = completedBookings.slice(0, 5).map((b) => ({
      id: b.id,
      teacher: b.teacher.name,
      avatar: b.teacher.avatarUrl,
      type: b.type,
      language: b.teacher.language || b.teacher.languages?.[0] || "Unknown",
      date: b.createdAt.toISOString(),
      amount: b.amountPaid,
    }));

    // Coin balance
    const coinBalance = await db.coinTransaction.aggregate({
      where: { userId },
      _sum: { amount: true },
    });

    return NextResponse.json({
      profile: {
        name: profile.name,
        languageToLearn: profile.languageToLearn,
        proficiencyLevel: profile.proficiencyLevel,
        avatarUrl: profile.avatarUrl,
      },
      stats: {
        totalClasses,
        totalHours,
        uniqueTeachers,
        coinBalance: coinBalance._sum.amount || 0,
        monthlyClasses: classesThisMonth, // Map monthlyClasses to classesThisMonth for backwards compatibility
        classesThisMonth,
        classesLastMonth,
        streak,
        bestStreak,
        streakDays,
        hoursThisWeek,
        hoursLastWeek,
      },
      practiceSeries,
      teachers,
      upcomingClasses: upcomingBookings.map((b) => {
        const nextSession = b.sessions.find(
          (s) => s.status === "SCHEDULED" && new Date(s.scheduledStart) > now
        );
        return {
          id: b.id,
          sessionId: nextSession?.id,
          teacher: b.teacher.name,
          avatar: b.teacher.avatarUrl,
          language: b.teacher.language || b.teacher.languages?.[0] || "Unknown",
          type: b.type,
          scheduledStart: nextSession?.scheduledStart.toISOString(),
          scheduledEnd: nextSession?.scheduledEnd.toISOString(),
        };
      }),
      recentActivity,
    });
  } catch (err) {
    console.error("GET /api/students/dashboard error:", err);
    // Return empty dashboard on error instead of 500
    const now = new Date();
    const defaultPracticeSeries = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - (i * 7));
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - d.getDay() + 1); // Monday start
      defaultPracticeSeries.push({
        weekStart: d.toISOString(),
        hours: 0,
        classes: 0,
      });
    }

    return NextResponse.json({
      profile: {
        name: "Student",
        languageToLearn: "",
        proficiencyLevel: "",
        avatarUrl: null,
      },
      stats: {
        totalClasses: 0,
        totalHours: 0,
        uniqueTeachers: 0,
        coinBalance: 0,
        monthlyClasses: 0,
        streak: 0,
        hoursThisWeek: 0,
        hoursLastWeek: 0,
        classesThisMonth: 0,
        classesLastMonth: 0,
        bestStreak: 0,
        streakDays: [false, false, false, false, false, false, false],
      },
      practiceSeries: defaultPracticeSeries,
      teachers: [],
      upcomingClasses: [],
      recentActivity: [],
    });
  }
}

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
        stats: {
          totalClasses: 0,
          totalHours: 0,
          uniqueTeachers: 0,
          coinBalance: 0,
          monthlyClasses: 0,
          streak: 0,
        },
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

    // Calculate stats
    const completedBookings = bookings.filter((b) => b.status === "COMPLETED");
    const totalClasses = completedBookings.reduce(
      (acc, b) => acc + b.sessions.filter((s) => s.status === "COMPLETED").length,
      0
    );
    const totalHours = totalClasses * 0.5;
    const uniqueTeachers = new Set(bookings.map((b) => b.teacherId)).size;

    // Upcoming classes (next 7 days)
    const now = new Date();
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

    // Streak calculation
    const completedSessions = bookings
      .flatMap((b) => b.sessions)
      .filter((s) => s.status === "COMPLETED" && s.actualEnd)
      .sort((a, b) => new Date(b.actualEnd!).getTime() - new Date(a.actualEnd!).getTime());

    // Monthly classes
    const monthlyClasses = completedBookings.filter((b) => {
      const sessionDate = b.sessions.find((s) => s.status === "COMPLETED")?.actualEnd;
      if (!sessionDate) return false;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return new Date(sessionDate) >= monthStart;
    }).length;

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
        monthlyClasses,
        streak: Math.min(completedSessions.length, 30),
      },
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
      },
      upcomingClasses: [],
      recentActivity: [],
    });
  }
}

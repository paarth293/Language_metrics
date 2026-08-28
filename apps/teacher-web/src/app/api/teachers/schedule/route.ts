import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const teacherId = auth.user.sub;

    const now = new Date();

    // Fetch all classes for the teacher
    const allBookings = await db.booking.findMany({
      where: { teacherId },
      include: {
        student: { select: { userId: true, name: true, avatarUrl: true, proficiencyLevel: true } },
        sessions: { orderBy: { scheduledStart: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });

    const upcoming: any[] = [];
    const past: any[] = [];

    allBookings.forEach((booking) => {
      // Find the next session
      const nextSession = booking.sessions.find(s => new Date(s.scheduledEnd) > now);
      
      const mapped = {
        id: booking.id,
        status: booking.status,
        student: booking.student,
        nextSession: nextSession ? {
          id: nextSession.id,
          status: nextSession.status,
          scheduledStart: nextSession.scheduledStart,
          scheduledEnd: nextSession.scheduledEnd,
        } : null,
        totalSessions: booking.sessions.length,
        completedSessions: booking.sessions.filter(s => s.status === "COMPLETED").length,
      };

      if (booking.status === "COMPLETED" || booking.status === "CANCELLED" || (!nextSession && booking.status !== "PENDING")) {
        past.push(mapped);
      } else {
        upcoming.push(mapped);
      }
    });

    return NextResponse.json({ upcoming, past }, { status: 200 });

  } catch (err) {
    console.error("GET /api/teachers/schedule error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

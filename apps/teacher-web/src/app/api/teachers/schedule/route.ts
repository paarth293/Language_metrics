import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJoinWindow } from "@repo/live-classes";

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

    const mappedBookings = allBookings.map((booking) => {
      // The next session that can still be joined. A class stays here until
      // its join window closes (scheduled end + grace), not just its end —
      // otherwise a class running a few minutes over vanished mid-lesson.
      const nextSession = booking.sessions.find(
        (s) =>
          s.status !== "COMPLETED" &&
          s.status !== "CANCELLED" &&
          getJoinWindow(s).closesAt > now
      );
      const joinWindow = nextSession ? getJoinWindow(nextSession) : null;

      return {
        id: booking.id,
        status: booking.status,
        type: booking.type,
        student: booking.student,
        nextSession: nextSession && joinWindow ? {
          id: nextSession.id,
          status: nextSession.status,
          scheduledStart: nextSession.scheduledStart,
          scheduledEnd: nextSession.scheduledEnd,
          joinOpensAt: joinWindow.opensAt,
          joinClosesAt: joinWindow.closesAt,
        } : null,
        totalSessions: booking.sessions.length,
        completedSessions: booking.sessions.filter(s => s.status === "COMPLETED").length,
      };
    });

    const past = mappedBookings.filter(b => b.status === "COMPLETED" || b.status === "CANCELLED" || (!b.nextSession && b.status !== "PENDING"));
    const upcoming = mappedBookings.filter(b => !(b.status === "COMPLETED" || b.status === "CANCELLED" || (!b.nextSession && b.status !== "PENDING")));

    return NextResponse.json({ upcoming, past }, { status: 200 });

  } catch (err) {
    console.error("GET /api/teachers/schedule error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

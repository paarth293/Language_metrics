import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentOrNextSession, getJoinWindow } from "@repo/live-classes";

export const dynamic = "force-dynamic";

const MAX_RANGE_MS = 62 * 24 * 60 * 60 * 1000;

type RangeSessionRow = {
  id: string;
  status: string;
  scheduledStart: string;
  scheduledEnd: string;
  bookingId: string;
  bookingStatus: string;
  bookingType: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  proficiencyLevel: string;
};
type AvailabilityRow = { dayOfWeek: number; startTime: string; endTime: string };

export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const teacherId = auth.user.sub;

    const now = new Date();

    // Range mode: every session in [from, to), for the calendar view.
    const url = new URL(request.url);
    const fromParam = url.searchParams.get("from");
    const toParam = url.searchParams.get("to");
    if (fromParam || toParam) {
      const from = new Date(fromParam ?? "");
      const to = new Date(toParam ?? "");
      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        to <= from ||
        to.getTime() - from.getTime() > MAX_RANGE_MS
      ) {
        return NextResponse.json({ message: "Invalid date range." }, { status: 400 });
      }

      // One statement for the week's classes and the working hours: the DB is
      // reached through a single pooled connection, so every extra query
      // (and every Prisma `include`) is another full round trip.
      const [row] = await db.$queryRaw<[{ sessions: RangeSessionRow[]; availability: AvailabilityRow[] }]>`
        SELECT
          (SELECT COALESCE(json_agg(x ORDER BY x."scheduledStart"), '[]'::json) FROM (
             SELECT s.id, s.status,
                    s."scheduledStart" AT TIME ZONE 'UTC' AS "scheduledStart",
                    s."scheduledEnd" AT TIME ZONE 'UTC' AS "scheduledEnd",
                    b.id AS "bookingId", b.status AS "bookingStatus", b.type AS "bookingType",
                    st."userId", st.name, st."avatarUrl", st."proficiencyLevel"
               FROM "ClassSession" s
               JOIN "Booking" b ON b.id = s."bookingId"
               JOIN "StudentProfile" st ON st."userId" = b."studentId"
              WHERE b."teacherId" = ${teacherId}::uuid
                AND s."scheduledStart" >= (${from}::timestamptz AT TIME ZONE 'UTC')
                AND s."scheduledStart" <  (${to}::timestamptz AT TIME ZONE 'UTC')
          ) x) AS sessions,
          (SELECT COALESCE(json_agg(json_build_object('dayOfWeek', "dayOfWeek", 'startTime', "startTime", 'endTime', "endTime")), '[]'::json)
             FROM "AvailabilitySlot" WHERE "teacherId" = ${teacherId}::uuid) AS availability
      `;

      return NextResponse.json(
        {
          sessions: row.sessions.map((s) => {
            const window = getJoinWindow({ scheduledStart: new Date(s.scheduledStart), scheduledEnd: new Date(s.scheduledEnd) });
            return {
              id: s.id,
              status: s.status,
              scheduledStart: s.scheduledStart,
              scheduledEnd: s.scheduledEnd,
              joinOpensAt: window.opensAt,
              joinClosesAt: window.closesAt,
              booking: { id: s.bookingId, status: s.bookingStatus, type: s.bookingType },
              student: { userId: s.userId, name: s.name, avatarUrl: s.avatarUrl, proficiencyLevel: s.proficiencyLevel },
            };
          }),
          availability: row.availability,
        },
        { status: 200 }
      );
    }

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
      const nextSession = currentOrNextSession(booking.sessions, now);
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

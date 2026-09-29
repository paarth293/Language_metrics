import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { currentOrNextSession, getJoinWindow } from "@repo/live-classes";

/**
 * GET /api/students/classes
 * Returns the student's bookings with session details.
 * Supports filtering by status (upcoming, past, cancelled).
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const url = new URL(request.url);
    const filter = url.searchParams.get("filter") || "upcoming";

    const now = new Date();

    // Build where clause based on filter
    type WhereInput = NonNullable<Parameters<typeof db.booking.findMany>[0]>["where"];
    const where: WhereInput = { studentId: userId };

    if (filter === "upcoming") {
      where.status = { in: ["PENDING", "CONFIRMED"] };
    } else if (filter === "past") {
      where.status = "COMPLETED";
    } else if (filter === "cancelled") {
      where.status = "CANCELLED";
    }

    const bookings = await db.booking.findMany({
      where,
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

    // Format response
    const formattedBookings = bookings.map((b) => {
      const completedSessions = b.sessions.filter((s) => s.status === "COMPLETED").length;
      // In progress or next up; kept until its join window closes so a class
      // doesn't vanish from the list the moment it starts.
      const nextSession = currentOrNextSession(b.sessions, now);
      const joinWindow = nextSession ? getJoinWindow(nextSession) : null;
      // Past its join window but not settled yet (the reconcile job settles
      // it). Returned so the card can say the class ended rather than claim
      // nothing was ever scheduled.
      const endedSession = nextSession
        ? undefined
        : [...b.sessions].reverse().find((s) => s.status === "SCHEDULED" || s.status === "ONGOING");

      // Determine status for display
      let displayStatus: string = b.status;
      if (nextSession && joinWindow) {
        if (nextSession.status === "ONGOING" || now >= nextSession.scheduledStart) {
          displayStatus = "ONGOING";
        } else if (now >= joinWindow.opensAt) {
          displayStatus = "STARTS_SOON";
        }
      }

      return {
        id: b.id,
        teacher: b.teacher.name,
        avatar: b.teacher.avatarUrl,
        language: b.teacher.language || b.teacher.languages?.[0] || "Unknown",
        type: b.type,
        status: displayStatus,
        totalSessions: b.sessions.length,
        completedSessions,
        nextSession: nextSession
          ? {
              id: nextSession.id,
              scheduledStart: nextSession.scheduledStart.toISOString(),
              scheduledEnd: nextSession.scheduledEnd.toISOString(),
              status: nextSession.status,
              joinOpensAt: joinWindow!.opensAt.toISOString(),
              joinClosesAt: joinWindow!.closesAt.toISOString(),
            }
          : null,
        endedSession: endedSession
          ? {
              scheduledStart: endedSession.scheduledStart.toISOString(),
              scheduledEnd: endedSession.scheduledEnd.toISOString(),
            }
          : null,
        review: b.review,
        amountPaid: b.amountPaid,
        createdAt: b.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ bookings: formattedBookings }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/classes error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

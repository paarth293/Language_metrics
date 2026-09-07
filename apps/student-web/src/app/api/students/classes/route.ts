import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateClassesFilter } from "@/lib/validation";
import { stripHtml } from "@/lib/sanitize";

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

    const filterValidation = validateClassesFilter(url.searchParams.get("filter"));
    if (!filterValidation.ok) {
      // FIX: an unrecognized `filter` value used to fall through this
      // if/else chain with no status condition applied at all, silently
      // returning EVERY booking (including cancelled/completed ones)
      // instead of the requested subset. Reject it instead.
      return NextResponse.json(
        { message: filterValidation.errors[0], errors: filterValidation.errors },
        { status: 400 }
      );
    }
    const filter = filterValidation.data;

    const now = new Date();

    // Build where clause based on filter
    const where: any = { studentId: userId };

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
      const nextSession = b.sessions.find(
        (s) => s.status === "SCHEDULED" && new Date(s.scheduledStart) > now
      );

      // Determine status for display
      let displayStatus = b.status;
      if (nextSession) {
        const timeUntil = new Date(nextSession.scheduledStart).getTime() - now.getTime();
        const minutesUntil = timeUntil / (1000 * 60);
        if (minutesUntil <= 10 && minutesUntil > 0) {
          displayStatus = "STARTS_SOON" as any;
        } else if (minutesUntil <= 0 && minutesUntil > -60) {
          displayStatus = "ONGOING" as any;
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
            }
          : null,
        review: b.review
          ? { rating: b.review.rating, comment: b.review.comment !== null ? stripHtml(b.review.comment) : null }
          : null,
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

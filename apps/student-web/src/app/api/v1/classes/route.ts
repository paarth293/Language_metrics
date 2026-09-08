import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireMobileAuth } from "@/lib/auth-mobile";
import {
  BookingListResponseSchema,
  type BookingListResponse,
} from "@repo/api-contracts";

/**
 * GET /api/v1/classes
 *
 * Mobile endpoint for listing authenticated student's booked classes.
 * Requires Bearer token in Authorization header.
 */
export async function GET(request: NextRequest) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const filter = url.searchParams.get("filter"); // upcoming, past, cancelled

  try {
    const studentId = auth.user.id;

    const whereClause: Record<string, unknown> = {
      studentId,
    };

    if (filter === "upcoming") {
      whereClause.status = { in: ["PENDING", "CONFIRMED"] };
    } else if (filter === "past") {
      whereClause.status = "COMPLETED";
    } else if (filter === "cancelled") {
      whereClause.status = "CANCELLED";
    }

    const [bookings, total] = await Promise.all([
      db.booking.findMany({
        where: whereClause,
        include: {
          teacher: {
            select: {
              name: true,
              avatarUrl: true,
            },
          },
          student: {
            select: {
              name: true,
            },
          },
          sessions: {
            orderBy: { scheduledStart: "asc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
      db.booking.count({ where: whereClause }),
    ]);

    const formattedBookings = bookings.map((b) => {
      const firstSession = b.sessions[0];
      const slotStart = firstSession?.scheduledStart
        ? new Date(firstSession.scheduledStart).toISOString()
        : new Date(b.createdAt).toISOString();
      const slotEnd = firstSession?.scheduledEnd
        ? new Date(firstSession.scheduledEnd).toISOString()
        : new Date(new Date(b.createdAt).getTime() + 60 * 60 * 1000).toISOString();

      return {
        id: b.id,
        teacherId: b.teacherId,
        teacherName: b.teacher.name,
        teacherAvatarUrl: b.teacher.avatarUrl ?? null,
        studentId: b.studentId,
        studentName: b.student.name,
        slotStart,
        slotEnd,
        status: b.status as "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED",
        coinCost: b.amountPaid,
        meetingUrl: null,
        createdAt: new Date(b.createdAt).toISOString(),
      };
    });

    const responsePayload: BookingListResponse = {
      bookings: formattedBookings,
      total,
    };

    const validated = BookingListResponseSchema.parse(responsePayload);
    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error("[Mobile API] Classes fetch error:", error);
    return NextResponse.json({ message: "Failed to fetch classes." }, { status: 500 });
  }
}

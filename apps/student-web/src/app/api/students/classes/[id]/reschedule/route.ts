import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { invalidateCache } from "@/lib/api-cache";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const body = await request.json();
    const newStartStr = body.newStartTime;

    if (!newStartStr) {
      return NextResponse.json({ error: "New start time is required." }, { status: 400 });
    }

    const newStartTime = new Date(newStartStr);
    const now = new Date();

    if (Number.isNaN(newStartTime.getTime()) || newStartTime <= now) {
      return NextResponse.json({ error: "The selected time must be in the future." }, { status: 400 });
    }

    const session = await db.classSession.findFirst({
      where: {
        id,
        booking: {
          studentId: auth.user.sub,
        },
      },
      include: {
        booking: {
          include: {
            teacher: {
              include: {
                availability: true,
              },
            },
          },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "Class session not found." }, { status: 404 });
    }

    if (session.status !== "SCHEDULED") {
      return NextResponse.json({ error: "Only scheduled classes can be rescheduled." }, { status: 400 });
    }

    // Check if within 1 hour range (+/- 1 hr)
    const diffMs = Math.abs(newStartTime.getTime() - session.scheduledStart.getTime());
    if (diffMs > 60 * 60 * 1000) {
      return NextResponse.json({ error: "You can only reschedule within a 1-hour window (before or after) of the original time." }, { status: 400 });
    }

    const durationMinutes = (session.scheduledEnd.getTime() - session.scheduledStart.getTime()) / 60000;
    const newEndTime = new Date(newStartTime.getTime() + durationMinutes * 60000);

    const teacher = session.booking.teacher;

    // Verify teacher availability
    const slotStartHour = newStartTime.getUTCHours();
    const slotStartMin = newStartTime.getUTCMinutes();
    const slotStartTotalMins = slotStartHour * 60 + slotStartMin;
    const slotEndTotalMins = slotStartTotalMins + durationMinutes;

    const isValidAvailability = teacher.availability.some((a) => {
      if (a.dayOfWeek !== newStartTime.getUTCDay()) return false;
      const [sH, sM] = a.startTime.split(":").map(Number);
      const startMins = sH * 60 + sM;
      const [eH, eM] = a.endTime.split(":").map(Number);
      const endMins = eH * 60 + eM;
      return slotStartTotalMins >= startMins && slotEndTotalMins <= endMins;
    });

    if (!isValidAvailability) {
      return NextResponse.json({ error: "The selected time is outside the teacher's available hours." }, { status: 400 });
    }

    // Check for overlap (1-on-1 constraint)
    const overlappingSession = await db.classSession.findFirst({
      where: {
        id: { not: session.id },
        booking: {
          teacherId: session.booking.teacherId,
        },
        status: { notIn: ["CANCELLED", "COMPLETED"] },
        scheduledStart: { lt: newEndTime },
        scheduledEnd: { gt: newStartTime },
      },
    });

    if (overlappingSession) {
      return NextResponse.json({ error: "This time slot has already been booked by another student." }, { status: 409 });
    }

    // Update the session
    await db.classSession.update({
      where: { id: session.id },
      data: {
        scheduledStart: newStartTime,
        scheduledEnd: newEndTime,
      },
    });

    invalidateCache("dashboard:");
    return NextResponse.json({ message: "Class rescheduled successfully." }, { status: 200 });
  } catch (error) {
    console.error("Reschedule error:", error);
    return NextResponse.json({ error: "Failed to reschedule class." }, { status: 500 });
  }
}

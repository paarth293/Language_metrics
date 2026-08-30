import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - List all recordings for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // Get sessions with recordings from the student's bookings
    const sessions = await prisma.classSession.findMany({
      where: {
        recordingUrl: { not: null },
        booking: {
          studentId: userId,
        },
      },
      include: {
        booking: {
          include: {
            teacher: {
              include: { user: true },
            },
          },
        },
      },
      orderBy: { scheduledStart: "desc" },
    });

    const recordings = sessions.map((session) => {
      const isPaid = session.isRecordingPaid;
      const duration = Math.floor(
        (new Date(session.scheduledEnd).getTime() -
          new Date(session.scheduledStart).getTime()) /
          1000
      );

      return {
        id: session.id,
        classSessionId: session.id,
        title: `${session.booking.teacher.name} Class`,
        teacherName: session.booking.teacher.name,
        language: session.booking.teacher.language || "Language",
        scheduledStart: session.scheduledStart.toISOString(),
        duration,
        isRecordingPaid: isPaid,
        unlockPrice: 299,
        videoUrl: isPaid ? session.recordingUrl : null,
        thumbnailUrl: null,
      };
    });

    return NextResponse.json({ recordings });
  } catch (error) {
    console.error("Failed to fetch recordings:", error);
    return NextResponse.json(
      { error: "Failed to fetch recordings" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/students/classes/[id]/reschedule
 *
 * Thin wrapper over `rescheduleClass` in @repo/live-classes, which checks the
 * move under the teacher's calendar lock and measures the 1-hour window from
 * the originally booked time.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { invalidateCache } from "@/lib/api-cache";
import { BookingError, rescheduleClass } from "@repo/live-classes";

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

    if (typeof newStartStr !== "string" || !newStartStr) {
      return NextResponse.json({ error: "New start time is required." }, { status: 400 });
    }

    await rescheduleClass({
      studentId: auth.user.sub,
      sessionId: id,
      newStart: new Date(newStartStr),
    });

    invalidateCache("dashboard:");
    return NextResponse.json({ message: "Class rescheduled successfully." }, { status: 200 });
  } catch (error) {
    if (error instanceof BookingError) {
      return NextResponse.json({ error: error.message }, { status: error.httpStatus });
    }
    console.error("Reschedule error:", error);
    return NextResponse.json({ error: "Failed to reschedule class." }, { status: 500 });
  }
}

/**
 * GET /api/admin/live/review — settlements a human should look at.
 * Almost always teacher no-shows, where the student was fully refunded and
 * somebody needs to decide what happens to the teacher.
 */
import { NextResponse } from "next/server";
import { requireApiAdmin } from "@/lib/api-auth";
import { getSessionsNeedingReview } from "@repo/live-classes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireApiAdmin(request, "classes:manage");
  if (!auth.ok) return auth.response;

  const rows = await getSessionsNeedingReview();
  return NextResponse.json(
    {
      items: rows.map((r) => ({
        classSessionId: r.classSessionId,
        studentName: r.classSession.booking.student.name,
        teacherName: r.classSession.booking.teacher.name,
        scheduledStart: r.classSession.scheduledStart.toISOString(),
        heldCoins: r.heldCoins,
        chargedCoins: r.chargedCoins,
        refundedCoins: r.refundedCoins,
        noShow: r.classSession.noShow,
        reason: r.reason,
        settledAt: r.settledAt?.toISOString() ?? null,
      })),
    },
    { status: 200 }
  );
}

/**
 * GET /api/cron/reconcile-payments (teacher-web): gone.
 *
 * The reconcile crons run on student-web only, so two deployments can no
 * longer sweep at once (#20). Point the GitHub workflow's APP_URL secret and
 * any other caller at student-web.
 */
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ message: "Cron jobs run on student-web.", moved_to: "student-web" }, { status: 410 });
}

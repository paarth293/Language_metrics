import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

const MAX_SPAN_MS = 45 * 24 * 60 * 60 * 1000;

function parseRange(url: URL, fromKey: string, toKey: string, fallback: () => [Date, Date]): [Date, Date] | null {
  const from = url.searchParams.get(fromKey);
  const to = url.searchParams.get(toKey);
  if (!from && !to) return fallback();
  const a = new Date(from ?? "");
  const b = new Date(to ?? "");
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b <= a || b.getTime() - a.getTime() > MAX_SPAN_MS) {
    return null;
  }
  return [a, b];
}

/**
 * GET /api/teachers/dashboard?weekStart&weekEnd&monthStart&monthEnd
 * Bounds are the browser's local week and month, as ISO instants; without
 * them the server's own clock is used.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  const url = new URL(request.url);
  const week = parseRange(url, "weekStart", "weekEnd", () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return [start, end];
  });
  const month = parseRange(url, "monthStart", "monthEnd", () => {
    const now = new Date();
    return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)];
  });
  if (!week || !month) {
    return NextResponse.json({ message: "Invalid date range." }, { status: 400 });
  }

  try {
    const data = await TeacherService.getDashboardData(auth.user.sub, {
      weekStart: week[0],
      weekEnd: week[1],
      monthStart: month[0],
      monthEnd: month[1],
    });
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/dashboard error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

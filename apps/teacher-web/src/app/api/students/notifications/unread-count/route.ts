import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/notifications/unread-count
 *
 * Unread notification count for the signed-in student — a COUNT only, so the
 * TopBar bell can refresh without downloading every notification.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const unreadCount = await db.notification.count({
      where: { userId: auth.user.sub, isRead: false },
    });
    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/notifications/unread-count error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

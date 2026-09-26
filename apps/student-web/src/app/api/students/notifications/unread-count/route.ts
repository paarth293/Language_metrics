import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/notifications/unread-count
 *
 * Returns only the unread notification count for the authenticated student.
 * Intentionally lightweight — does a COUNT query, not a full list fetch.
 * Used by the TopBar bell badge so it can poll without downloading every notification.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({ unreadCount }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/notifications/unread-count error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

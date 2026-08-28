import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/notifications
 * Returns the student's notifications.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);

    const notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/notifications error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

/**
 * PUT /api/students/notifications
 * Mark notifications as read.
 */
export async function PUT(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const body = await request.json().catch(() => ({}));

    if (body.notificationId) {
      // Mark single notification as read
      await db.notification.updateMany({
        where: { id: body.notificationId, userId },
        data: { isRead: true },
      });
    } else {
      // Mark all as read
      await db.notification.updateMany({
        where: { userId, isRead: false },
        data: { isRead: true },
      });
    }

    return NextResponse.json({ message: "Notifications updated." }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/students/notifications error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/notifications
 * Returns the teacher's notifications (paginated).
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
    const notifications = await TeacherService.getNotifications(auth.user.sub, limit);
    const unreadCount = notifications.filter((n) => !n.isRead).length;

    return NextResponse.json({ notifications, unreadCount }, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/notifications error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

/**
 * PUT /api/teachers/notifications
 * Mark notifications as read.
 * Body: { notificationId?: string } — marks one; omit to mark all
 */
export async function PUT(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const body = await request.json().catch(() => ({}));

    if (body.notificationId) {
      await TeacherService.markNotificationRead(auth.user.sub, body.notificationId);
    } else {
      await TeacherService.markAllNotificationsRead(auth.user.sub);
    }

    return NextResponse.json({ message: "Notifications updated." }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/teachers/notifications error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

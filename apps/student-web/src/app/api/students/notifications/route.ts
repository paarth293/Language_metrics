import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateNotificationUpdate } from "@/lib/validation";
import { exceedsMaxBodySize } from "@/lib/rate-limit";

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

    // Guard against a non-numeric `limit` (e.g. "?limit=abc") reaching
    // Prisma as NaN, which `take: NaN` would turn into a thrown error.
    const rawLimit = url.searchParams.get("limit");
    let limit = 50;
    if (rawLimit !== null) {
      const parsed = Number.parseInt(rawLimit, 10);
      if (Number.isFinite(parsed) && parsed > 0) {
        limit = Math.min(parsed, 100);
      }
    }

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

  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  try {
    const userId = auth.user.sub;
    const body = await request.json().catch(() => ({}));

    const validation = validateNotificationUpdate(body);
    if (!validation.ok) {
      return NextResponse.json(
        { message: validation.errors[0], errors: validation.errors },
        { status: 400 }
      );
    }

    if (validation.data.notificationId) {
      // Mark single notification as read
      await db.notification.updateMany({
        where: { id: validation.data.notificationId, userId },
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

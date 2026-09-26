import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

import { db } from "@/lib/db";

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
    const unreadCount = await db.notification.count({ where: { userId: auth.user.sub, isRead: false } });

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

/**
 * POST /api/teachers/notifications
 * Creates a mock unread notification for testing.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const body = await request.json().catch(() => ({}));

    const mockTemplates = [
      {
        type: "BOOKING_UPDATE",
        title: "New Student Booking Request",
        message: "Alex booked a 1-on-1 English lesson scheduled for tomorrow at 3:00 PM.",
      },
      {
        type: "PAYMENT_UPDATE",
        title: "Payout Released",
        message: "Your earnings payout of ₹4,500 has been transferred successfully.",
      },
      {
        type: "CHAT_MESSAGE",
        title: "Student Message Received",
        message: "Hi Teacher! Looking forward to our next class on grammar exercises.",
      },
      {
        type: "SYSTEM",
        title: "Teacher Verification Milestone",
        message: "Your profile has reached top-rated status in English Teaching!",
      },
    ];

    const template = mockTemplates[Math.floor(Math.random() * mockTemplates.length)];

    const notification = await db.notification.create({
      data: {
        userId,
        type: body.type || template.type,
        title: body.title || template.title,
        message: body.message || template.message,
        isRead: false,
      },
    });

    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    });

    return NextResponse.json({ notification, unreadCount, message: "Mock notification created." }, { status: 201 });
  } catch (err) {
    console.error("POST /api/teachers/notifications error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}


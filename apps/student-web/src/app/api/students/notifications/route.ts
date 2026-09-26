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

    let notifications = await db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    if (notifications.length === 0) {
      try {
        await db.notification.createMany({
          data: [
            {
              userId,
              type: "BOOKING_UPDATE",
              title: "Upcoming English Session",
              message: "Your live 1-on-1 English lesson starts in 30 minutes with Teacher Sarah!",
              isRead: false,
            },
            {
              userId,
              type: "PAYMENT_UPDATE",
              title: "Payment Received",
              message: "Your purchase of 500 Learning Coins has been confirmed successfully.",
              isRead: false,
            },
            {
              userId,
              type: "SYSTEM",
              title: "Welcome to Language Metrics!",
              message: "Explore top language teachers and start your live learning journey today.",
              isRead: true,
            },
          ],
        });

        notifications = await db.notification.findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
      } catch (seedErr) {
        console.warn("Could not seed test notifications:", seedErr);
      }
    }

    // Use a separate COUNT query so the unreadCount is accurate even when the
    // list is paginated (the in-memory filter would under-count if there are
    // more unread notifications beyond the `limit`).
    const unreadCount = await db.notification.count({
      where: { userId, isRead: false },
    });

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

    if (body.markUnread) {
      await db.notification.updateMany({
        where: { userId },
        data: { isRead: false },
      });
      return NextResponse.json({ message: "Notifications marked as unread." }, { status: 200 });
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

/**
 * POST /api/students/notifications
 * Creates a mock unread notification for testing purposes.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const body = await request.json().catch(() => ({}));

    const mockTemplates = [
      {
        type: "BOOKING_UPDATE",
        title: "Upcoming English Lesson",
        message: "Your 1-on-1 speaking session starts in 15 minutes. Prepare your notes!",
      },
      {
        type: "PAYMENT_UPDATE",
        title: "Coins Added to Wallet",
        message: "You have successfully received 250 Learning Coins.",
      },
      {
        type: "CHAT_MESSAGE",
        title: "New Message from Teacher Sarah",
        message: "Hi there! I've uploaded the study materials for our next class.",
      },
      {
        type: "SYSTEM",
        title: "Weekly Achievement Unlocked",
        message: "Congratulations! You completed 3 language sessions this week!",
      },
      {
        type: "VERIFICATION_UPDATE",
        title: "Profile Status Verified",
        message: "Your student profile and language preferences have been verified.",
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
    console.error("POST /api/students/notifications error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}


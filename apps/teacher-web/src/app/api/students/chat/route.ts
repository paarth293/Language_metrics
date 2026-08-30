import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// GET - List all chat threads for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // Get all bookings to find unique teachers
    const bookings = await prisma.booking.findMany({
      where: { studentId: userId },
      include: {
        teacher: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    interface ChatThread {
      teacherId: string;
      teacherName: string;
      teacherAvatar: string | null;
      language: string;
      lastMessage: string;
      lastMessageTime: string;
      unreadCount: number;
    }

    // Build unique teacher threads
    const teacherMap = new Map<string, ChatThread>();

    for (const booking of bookings) {
      const teacherId = booking.teacher.userId;
      if (!teacherMap.has(teacherId)) {
        // Get last message for this thread
        const lastMessage = await prisma.chatMessage.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: teacherId },
              { senderId: teacherId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        teacherMap.set(teacherId, {
          teacherId,
          teacherName: booking.teacher.name,
          teacherAvatar: booking.teacher.avatarUrl || null,
          language: booking.teacher.language || "General",
          lastMessage: lastMessage?.content || "No messages yet",
          lastMessageTime:
            lastMessage?.createdAt.toISOString() ||
            booking.createdAt.toISOString(),
          unreadCount: 0,
        });
      }
    }

    const threads = Array.from(teacherMap.values());

    // Sort by last message time
    threads.sort(
      (a, b) =>
        new Date(b.lastMessageTime).getTime() -
        new Date(a.lastMessageTime).getTime()
    );

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Failed to fetch chat threads:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat threads" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET - List all chat threads for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // Get all bookings to find unique students
    const bookings = await prisma.booking.findMany({
      where: { teacherId: userId },
      include: {
        student: {
          include: { user: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    interface ChatThread {
      studentId: string;
      studentName: string;
      studentAvatar: string | null;
      language: string;
      lastMessage: string;
      lastMessageTime: string;
      unreadCount: number;
    }

    // Build unique teacher threads
    const studentMap = new Map<string, ChatThread>();

    for (const booking of bookings) {
      const studentId = booking.student.userId;
      if (!studentMap.has(studentId)) {
        // Get last message for this thread
        const lastMessage = await prisma.chatMessage.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: studentId },
              { senderId: studentId, receiverId: userId },
            ],
          },
          orderBy: { createdAt: "desc" },
        });

        studentMap.set(studentId, {
          studentId,
          studentName: booking.student.name,
          studentAvatar: booking.student.avatarUrl || null,
          language: "General",
          lastMessage: lastMessage?.content || "No messages yet",
          lastMessageTime:
            lastMessage?.createdAt.toISOString() ||
            booking.createdAt.toISOString(),
          unreadCount: 0,
        });
      }
    }

    const threads = Array.from(studentMap.values());

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


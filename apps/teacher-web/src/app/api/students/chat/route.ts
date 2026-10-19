import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchLastMessages } from "@/lib/chat-threads";
import { stripHtml, sanitizeOrFallback } from "@/lib/sanitize";

// GET - List all chat threads for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // One row per teacher the student has booked, with the latest booking
    // time as the fallback for threads that have no messages yet.
    const bookedTeachers = await prisma.booking.groupBy({
      by: ["teacherId"],
      where: { studentId: userId },
      _max: { createdAt: true },
    });
    const teacherIds = bookedTeachers.map((b) => b.teacherId);

    // Only the columns the thread list shows; never the teacher's user row.
    const teachers = teacherIds.length > 0
      ? await prisma.teacherProfile.findMany({
          where: { userId: { in: teacherIds } },
          select: { userId: true, name: true, avatarUrl: true, language: true },
        })
      : [];
    const teachersById = new Map(teachers.map((t) => [t.userId, t]));

    // The newest message per teacher, from one DISTINCT ON query instead of
    // one query per teacher.
    const messagesByTeacher = await fetchLastMessages(userId, teacherIds);

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

    for (const booking of bookedTeachers) {
      const teacherId = booking.teacherId;
      const teacher = teachersById.get(teacherId);
      if (teacher && !teacherMap.has(teacherId)) {
        const lastMessage = messagesByTeacher.get(teacherId);

        teacherMap.set(teacherId, {
          teacherId,
          teacherName: sanitizeOrFallback(teacher.name, ""),
          teacherAvatar: teacher.avatarUrl || null,
          language: teacher.language || "General",
          lastMessage: lastMessage ? stripHtml(lastMessage.content) || "No messages yet" : "No messages yet",
          lastMessageTime: (lastMessage?.createdAt ?? booking._max.createdAt ?? new Date(0)).toISOString(),
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

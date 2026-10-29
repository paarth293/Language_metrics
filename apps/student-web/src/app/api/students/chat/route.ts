import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripHtml, sanitizeOrFallback } from "@/lib/sanitize";
import { fetchLastMessages } from "@/lib/chat-threads";

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

    // PERFORMANCE FIX: the newest message per teacher comes from one
    // DISTINCT ON query instead of loading every message in every thread.
    const messagesByTeacher = await fetchLastMessages(userId, teacherIds);

    // Build unique teacher threads
    const teacherMap = new Map<string, { teacherId: string; teacherName: string; teacherAvatar: string | null; language: string; lastMessage: string; lastMessageTime: string; unreadCount: number }>();

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
          // Defense-in-depth: this is genuine free-text chat content typed
          // by another user (the teacher, or the student themself), so
          // unlike a bio it's realistic for someone to actually try
          // injecting markup here. Currently inert either way — the chat
          // UI renders this as plain JSX text, which React escapes — but
          // stripping it at the API boundary protects any future renderer
          // change or non-web client. See docs/audits/error-log.md.
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

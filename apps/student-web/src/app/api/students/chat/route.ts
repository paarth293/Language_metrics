import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripHtml, sanitizeOrFallback } from "@/lib/sanitize";

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

    const teacherIds = Array.from(new Set(bookings.map((b) => b.teacher.userId)));

    // PERFORMANCE FIX: this used to run one `chatMessage.findFirst` query
    // per unique teacher INSIDE the loop below (a classic N+1 — a student
    // messaging 20 different teachers meant 20 sequential round trips to
    // the database just to render their thread list). Fetch every
    // candidate message in a single query instead, then pick the most
    // recent one per teacher in memory.
    const allMessages =
      teacherIds.length > 0
        ? await prisma.chatMessage.findMany({
            where: {
              OR: teacherIds.flatMap((teacherId) => [
                { senderId: userId, receiverId: teacherId },
                { senderId: teacherId, receiverId: userId },
              ]),
            },
            orderBy: { createdAt: "desc" },
          })
        : [];
    const messagesByTeacher = new Map<string, (typeof allMessages)[number]>();
    for (const message of allMessages) {
      const counterpartId = message.senderId === userId ? message.receiverId : message.senderId;
      // Results are ordered newest-first, so the first message seen for a
      // given counterpart is that thread's most recent message.
      if (!messagesByTeacher.has(counterpartId)) {
        messagesByTeacher.set(counterpartId, message);
      }
    }

    // Build unique teacher threads
    const teacherMap = new Map<string, any>();

    for (const booking of bookings) {
      const teacherId = booking.teacher.userId;
      if (!teacherMap.has(teacherId)) {
        const lastMessage = messagesByTeacher.get(teacherId);

        teacherMap.set(teacherId, {
          teacherId,
          teacherName: sanitizeOrFallback(booking.teacher.name, ""),
          teacherAvatar: booking.teacher.avatarUrl || null,
          language: booking.teacher.language || "General",
          // Defense-in-depth: this is genuine free-text chat content typed
          // by another user (the teacher, or the student themself), so
          // unlike a bio it's realistic for someone to actually try
          // injecting markup here. Currently inert either way — the chat
          // UI renders this as plain JSX text, which React escapes — but
          // stripping it at the API boundary protects any future renderer
          // change or non-web client. See errors.md.
          lastMessage: lastMessage ? stripHtml(lastMessage.content) || "No messages yet" : "No messages yet",
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
      (a: any, b: any) =>
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

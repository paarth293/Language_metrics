import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchLastMessages } from "@/lib/chat-threads";

export const dynamic = "force-dynamic";

// GET - List all chat threads for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // One row per student who booked this teacher, with the latest booking
    // time as the fallback for threads that have no messages yet.
    const bookedStudents = await prisma.booking.groupBy({
      by: ["studentId"],
      where: { teacherId: userId },
      _max: { createdAt: true },
    });
    const studentIds = bookedStudents.map((b) => b.studentId);

    // Only the columns the thread list shows; never the student's user row.
    const students = studentIds.length > 0
      ? await prisma.studentProfile.findMany({
          where: { userId: { in: studentIds } },
          select: { userId: true, name: true, avatarUrl: true },
        })
      : [];
    const studentsById = new Map(students.map((s) => [s.userId, s]));

    // The newest message per student, from one DISTINCT ON query instead of
    // one query per student.
    const messagesByStudent = await fetchLastMessages(userId, studentIds);

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

    for (const booking of bookedStudents) {
      const studentId = booking.studentId;
      const student = studentsById.get(studentId);
      if (student && !studentMap.has(studentId)) {
        const lastMessage = messagesByStudent.get(studentId);

        studentMap.set(studentId, {
          studentId,
          studentName: student.name,
          studentAvatar: student.avatarUrl || null,
          language: "General",
          lastMessage: lastMessage?.content || "No messages yet",
          lastMessageTime: (lastMessage?.createdAt ?? booking._max.createdAt ?? new Date(0)).toISOString(),
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


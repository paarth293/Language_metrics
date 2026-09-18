import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { stripHtml } from "@/lib/sanitize";
import { validateChatMessage } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { uploadFile } from "@/lib/storage";

const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB, matches lib/storage.ts's default

/**
 * Confirms the student actually has a relationship with this teacher before
 * letting them read or send chat messages. Mirrors the thread-list logic in
 * chat/route.ts, which only ever surfaces teachers the student has booked —
 * this route previously trusted the `teacherId` URL param completely, with
 * no check that it even named a teacher (let alone one this student had
 * interacted with). That meant any authenticated student could POST to any
 * user ID in the system — another student's account included — landing
 * unsolicited messages in a stranger's inbox with no relationship, and
 * without this fix `content` in an attacker-crafted GET/POST would happily
 * read back messages between the caller and any userId they chose to try
 * (all still scoped to the caller's own side of the conversation, since the
 * OR clause pins one side to `userId`, but still lets someone probe which
 * IDs have ever exchanged a message with them).
 */
async function verifyTeacherRelationship(userId: string, teacherId: string): Promise<boolean> {
  const teacher = await prisma.teacherProfile.findUnique({
    where: { userId: teacherId },
    select: { userId: true },
  });
  if (!teacher) return false;

  const hasBooking = await prisma.booking.findFirst({
    where: { studentId: userId, teacherId },
    select: { id: true },
  });
  return Boolean(hasBooking);
}

// GET - Get messages with a specific teacher
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ teacherId: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const { teacherId } = await context.params;

    const authorized = await verifyTeacherRelationship(userId, teacherId);
    if (!authorized) {
      return NextResponse.json(
        { error: "You don't have a conversation with this teacher." },
        { status: 403 }
      );
    }

    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: teacherId },
          { senderId: teacherId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    // SECURITY FIX: message content is free text typed by the other party
    // (the teacher) and was returned completely unsanitized — the same
    // stored-XSS shape already fixed in chat/route.ts's thread previews.
    // This is the actual message body, so it's the higher-value target of
    // the two.
    const sanitizedMessages = messages.map((m) => ({
      ...m,
      content: stripHtml(m.content),
    }));

    return NextResponse.json({ messages: sanitizedMessages });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST - Send a message to a teacher
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teacherId: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  if (exceedsMaxBodySize(request, MAX_ATTACHMENT_SIZE)) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const userId = auth.user.sub;
  const isLimited = await rateLimitRedis(userId, "chat-send", { windowMs: 60_000, max: 30 });
  if (isLimited) {
    return NextResponse.json({ error: "Too many messages. Please slow down." }, { status: 429 });
  }

  try {
    const { teacherId } = await context.params;

    const authorized = await verifyTeacherRelationship(userId, teacherId);
    if (!authorized) {
      return NextResponse.json(
        { error: "You don't have a conversation with this teacher." },
        { status: 403 }
      );
    }

    const contentType = request.headers.get("content-type") || "";
    let content = "";
    let attachmentUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const rawContent = formData.get("content");
      const contentValidation = validateChatMessage({
        content: typeof rawContent === "string" ? rawContent : undefined,
      });
      if (!contentValidation.ok) {
        return NextResponse.json(
          { code: "VALIDATION_ERROR", error: contentValidation.errors[0], errors: contentValidation.errors },
          { status: 400 }
        );
      }
      content = contentValidation.data.content;

      const file = formData.get("file") as File | null;
      if (file && file.size > 0) {
        // BUG FIX: the old code did `attachmentUrl = file.name` — it never
        // read the file's bytes at all. The uploaded file was silently
        // discarded on every single send; the chat message was stored with
        // what LOOKED like a URL (the original filename) but pointed
        // nowhere, so clicking any "attachment" in a chat thread would 404.
        // This actually persists the file through the same storage
        // abstraction (`lib/storage.ts`) the rest of the app already has
        // ready to use, and stores its real, resolvable URL.
        try {
          const arrayBuffer = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const uploaded = await uploadFile(buffer, file.name, file.type, {
            folder: "chat-attachments",
            allowedTypes: ALLOWED_ATTACHMENT_TYPES,
            maxSizeBytes: MAX_ATTACHMENT_SIZE,
          });
          attachmentUrl = uploaded.url;
        } catch (uploadError) {
          const message = uploadError instanceof Error ? uploadError.message : "File upload failed.";
          return NextResponse.json({ error: message }, { status: 400 });
        }
      }
    } else {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }
      const contentValidation = validateChatMessage(body);
      if (!contentValidation.ok) {
        return NextResponse.json(
          { code: "VALIDATION_ERROR", error: contentValidation.errors[0], errors: contentValidation.errors },
          { status: 400 }
        );
      }
      content = contentValidation.data.content;
    }

    if (!content && !attachmentUrl) {
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const autoDeleteAt = new Date();
    autoDeleteAt.setDate(autoDeleteAt.getDate() + 90);

    const message = await prisma.chatMessage.create({
      data: {
        senderId: userId,
        receiverId: teacherId,
        content: content || "[Attachment]",
        attachmentUrl,
        autoDeleteAt,
      },
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    console.error("Failed to send message:", error);
    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}

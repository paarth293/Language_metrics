import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchConversationPage, parseChatPageQuery } from "@/lib/chat-messages";
import { hasBooking } from "@/lib/chat-access";
import { stripHtml } from "@/lib/sanitize";
import { validateChatMessage } from "@repo/api-contracts";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";
import { uploadFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

const NO_CONVERSATION = "You don't have a conversation with this student.";
const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
];
const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB, matches lib/storage.ts's default

// GET - Get messages with a specific student
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const { studentId } = await context.params;

    if (!(await hasBooking(studentId, userId))) {
      return NextResponse.json({ error: NO_CONVERSATION }, { status: 403 });
    }

    const parsed = parseChatPageQuery(request.nextUrl.searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const page = await fetchConversationPage(prisma.chatMessage, userId, studentId, parsed.query);

    // Message content is free text typed by the other party; strip HTML before
    // returning it, as student-web does.
    const messages = page.messages.map((m) => ({ ...m, content: stripHtml(m.content) }));

    return NextResponse.json({ messages, hasMore: page.hasMore, cursor: page.cursor });
  } catch (error) {
    console.error("Failed to fetch messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}

// POST - Send a message to a student
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ studentId: string }> }
) {
  const auth = await requireAuth(request, "TEACHER");
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
    const { studentId } = await context.params;

    if (!(await hasBooking(studentId, userId))) {
      return NextResponse.json({ error: NO_CONVERSATION }, { status: 403 });
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
        // The old code stored `file.name` as the attachment URL and never
        // read the file. Upload it through lib/storage, as student-web does;
        // uploadFile checks the bytes against the claimed type and names the
        // stored file itself.
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
        receiverId: studentId,
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

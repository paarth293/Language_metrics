import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fetchConversationPage, parseChatPageQuery } from "@/lib/chat-messages";
import { hasBooking } from "@/lib/chat-access";
import { stripHtml } from "@/lib/sanitize";
import { validateChatMessage } from "@repo/api-contracts";

const NO_CONVERSATION = "You don't have a conversation with this teacher.";

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

    if (!(await hasBooking(userId, teacherId))) {
      return NextResponse.json({ error: NO_CONVERSATION }, { status: 403 });
    }

    const parsed = parseChatPageQuery(request.nextUrl.searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const page = await fetchConversationPage(prisma.chatMessage, userId, teacherId, parsed.query);

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

// POST - Send a message to a teacher
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ teacherId: string }> }
) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;
    const { teacherId } = await context.params;

    if (!(await hasBooking(userId, teacherId))) {
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

      const file = formData.get("file") as File;
      if (file) {
        attachmentUrl = file.name;
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

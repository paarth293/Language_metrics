import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const messages = await prisma.chatMessage.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: teacherId },
          { senderId: teacherId, receiverId: userId },
        ],
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ messages });
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

    const contentType = request.headers.get("content-type") || "";
    let content = "";
    let attachmentUrl: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      content = (formData.get("content") as string) || "";
      const file = formData.get("file") as File;
      if (file) {
        attachmentUrl = file.name;
      }
    } else {
      const body = await request.json();
      content = body.content || "";
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

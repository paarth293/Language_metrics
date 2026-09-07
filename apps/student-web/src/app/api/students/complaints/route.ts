import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { validateComplaint } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";

// GET - List all complaints/tickets for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const tickets = await prisma.complaint.findMany({
      where: { studentId: auth.user.sub },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets });
  } catch (error) {
    console.error("Failed to fetch complaints:", error);
    return NextResponse.json(
      { error: "Failed to fetch tickets" },
      { status: 500 }
    );
  }
}

// POST - Create a new complaint/ticket
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ error: "Request body too large." }, { status: 413 });
  }

  const isLimited = await rateLimitRedis(auth.user.sub, "complaints", { windowMs: 60_000, max: 10 });
  if (isLimited) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateComplaint(body);
  if (!validation.ok) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", error: validation.errors[0], errors: validation.errors },
      { status: 400 }
    );
  }
  const { category, subject, description } = validation.data;

  try {
    const userId = auth.user.sub;

    // Map category to ComplaintCategory enum
    const categoryMap: Record<string, string> = {
      PAYMENT_ISSUE: "PAYMENT",
      CLASS_QUALITY: "OTHER",
      TEACHER_BEHAVIOR: "TEACHER_BEHAVIOUR",
      TECHNICAL_ISSUE: "OTHER",
      BOOKING_ISSUE: "OTHER",
      REFUND_REQUEST: "REFUND",
      ACCOUNT_ISSUE: "OTHER",
      OTHER: "OTHER",
    };

    const ticket = await prisma.complaint.create({
      data: {
        studentId: userId,
        ticketNumber: `TKT-${Date.now().toString(36).toUpperCase()}`,
        category: (categoryMap[category] || "OTHER") as any,
        subject,
        description,
        status: "NEW",
      },
    });

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return NextResponse.json(
      { error: "Failed to create complaint" },
      { status: 500 }
    );
  }
}

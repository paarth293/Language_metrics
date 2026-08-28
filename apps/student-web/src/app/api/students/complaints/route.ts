import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

  try {
    const userId = auth.user.sub;
    const body = await request.json();
    const { category, subject, description } = body;

    if (!category || !subject || !description) {
      return NextResponse.json(
        { error: "Category, subject, and description are required" },
        { status: 400 }
      );
    }

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

import { NextRequest, NextResponse } from "next/server";

// Enum for complaint categories
enum ComplaintCategory {
  PAYMENT = "PAYMENT",
  OTHER = "OTHER",
  TEACHER_BEHAVIOUR = "TEACHER_BEHAVIOUR",
  REFUND = "REFUND",
}
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// The admin panel works with the ComplaintStatus enum; the student support page
// only knows PENDING / IN_PROGRESS / RESOLVED / CLOSED, so translate here.
const STUDENT_STATUS: Record<string, string> = {
  NEW: "PENDING",
  INVESTIGATING: "IN_PROGRESS",
  ACTION_REQUIRED: "IN_PROGRESS",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
};

function toStudentTicket<T extends { status: string }>(ticket: T) {
  return { ...ticket, status: STUDENT_STATUS[ticket.status] ?? "PENDING" };
}

// GET - List all complaints/tickets for the student
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const tickets = await prisma.complaint.findMany({
      where: { studentId: auth.user.sub },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ tickets: tickets.map(toStudentTicket) });
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
    const categoryMap: Record<string, ComplaintCategory> = {
      PAYMENT_ISSUE: ComplaintCategory.PAYMENT,
      CLASS_QUALITY: ComplaintCategory.OTHER,
      TEACHER_BEHAVIOR: ComplaintCategory.TEACHER_BEHAVIOUR,
      TECHNICAL_ISSUE: ComplaintCategory.OTHER,
      BOOKING_ISSUE: ComplaintCategory.OTHER,
      REFUND_REQUEST: ComplaintCategory.REFUND,
      ACCOUNT_ISSUE: ComplaintCategory.OTHER,
      OTHER: ComplaintCategory.OTHER,
    };

    const ticket = await prisma.complaint.create({
      data: {
        studentId: userId,
        ticketNumber: `TKT-${Date.now().toString(36).toUpperCase()}`,
        category: (categoryMap[category as keyof typeof categoryMap] ?? ComplaintCategory.OTHER),
        subject,
        description,
        status: "NEW",
      },
    });

    return NextResponse.json({ ticket: toStudentTicket(ticket) }, { status: 201 });
  } catch (error) {
    console.error("Failed to create complaint:", error);
    return NextResponse.json(
      { error: "Failed to create complaint" },
      { status: 500 }
    );
  }
}

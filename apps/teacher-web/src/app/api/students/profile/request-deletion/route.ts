import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { revokeAllRefreshSessions } from "@/lib/redis-session";

// POST - Request account deletion (soft-delete / flag for admin)
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const userId = auth.user.sub;

    // Check if there are active bookings
    const activeBookings = await prisma.booking.count({
      where: {
        studentId: userId,
        status: { in: ["PENDING", "CONFIRMED"] },
      },
    });

    if (activeBookings > 0) {
      return NextResponse.json(
        {
          error:
            "You have active bookings. Please cancel or complete them before requesting deletion.",
        },
        { status: 400 }
      );
    }

    // Update student profile status
    await prisma.studentProfile.update({
      where: { userId },
      data: { status: "SUSPENDED" },
    });

    // Revoke all refresh tokens
    try {
      await revokeAllRefreshSessions(userId);
    } catch {
      // Redis might not be available, that's fine
    }

    return NextResponse.json({
      success: true,
      message:
        "Account deletion request submitted. Your data will be removed within 30 days.",
    });
  } catch (error) {
    console.error("Failed to request deletion:", error);
    return NextResponse.json(
      { error: "Failed to request account deletion" },
      { status: 500 }
    );
  }
}

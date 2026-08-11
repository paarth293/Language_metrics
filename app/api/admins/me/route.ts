import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/server/authGuard";

/**
 * GET /api/admins/me
 * Returns the authenticated admin's profile.
 */
export async function GET(request: Request) {
  const auth = requireRole(request, "ADMIN");
  if (auth.response) return auth.response;

  try {
    const admin = await prisma.admin.findUnique({
      where: { userId: auth.user.userId },
      include: { user: { select: { id: true, name: true, email: true, createdAt: true } } },
    });

    if (!admin) {
      return NextResponse.json({ message: "Admin profile not found." }, { status: 404 });
    }

    return NextResponse.json({ admin }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (admin) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

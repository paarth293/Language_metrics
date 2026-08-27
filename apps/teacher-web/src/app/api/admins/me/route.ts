import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { AdminService } from "@/features/admin/services/admin-service";

/**
 * GET /api/admins/me
 * Returns the authenticated admin's profile.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "ADMIN");
  if (auth.error) return auth.error;

  try {
    const admin = await AdminService.getProfile(auth.user.sub);
    if (!admin) {
      return NextResponse.json({ message: "Admin profile not found." }, { status: 404 });
    }

    return NextResponse.json({ admin }, { status: 200 });
  } catch (err) {
    console.error("getMyProfile (admin) error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

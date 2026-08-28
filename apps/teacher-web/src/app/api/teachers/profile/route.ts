import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { TeacherService } from "@/features/teacher/services/teacher-service";

/**
 * GET /api/teachers/profile
 * Returns the full teacher profile including documents.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const profile = await TeacherService.getProfileWithSettings(auth.user.sub);
    if (!profile) {
      return NextResponse.json({ message: "Profile not found." }, { status: 404 });
    }
    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("GET /api/teachers/profile error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

/**
 * PUT /api/teachers/profile
 * Update the teacher's profile (bio, avatar, demo video).
 */
export async function PUT(request: Request) {
  const auth = await requireAuth(request, "TEACHER");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { bio, avatarUrl, demoVideoUrl } = body;

    const updateData: { bio?: string; avatarUrl?: string; demoVideoUrl?: string } = {};
    if (bio !== undefined) updateData.bio = bio;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (demoVideoUrl !== undefined) updateData.demoVideoUrl = demoVideoUrl;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No fields to update." }, { status: 400 });
    }

    const profile = await TeacherService.updateProfile(auth.user.sub, updateData);
    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/teachers/profile error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";

// Interface for profile update fields
interface StudentProfileUpdate {
  name?: string;
  avatarUrl?: string | null;
  languageToLearn?: string;
  proficiencyLevel?: string;
}
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/students/profile
 * Returns the authenticated student's full profile.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const profile = await db.studentProfile.findUnique({
      where: { userId: auth.user.sub },
      include: {
        user: {
          select: { id: true, email: true, emailVerified: true, createdAt: true },
        },
        bookings: {
          select: { id: true, status: true },
        },
      },
    });

    if (!profile) {
      return NextResponse.json({ message: "Profile not found." }, { status: 404 });
    }

    const totalBookings = profile.bookings.length;
    const completedBookings = profile.bookings.filter((b) => b.status === "COMPLETED").length;

    return NextResponse.json(
      {
        profile: {
          userId: profile.userId,
          name: profile.name,
          email: profile.user.email,
          emailVerified: profile.user.emailVerified,
          avatarUrl: profile.avatarUrl,
          languageToLearn: profile.languageToLearn,
          proficiencyLevel: profile.proficiencyLevel,
          status: profile.status,
          onboardingComplete: profile.onboardingComplete,
          totalBookings,
          completedBookings,
          memberSince: profile.user.createdAt.toISOString(),
        },
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("GET /api/students/profile error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

/**
 * PUT /api/students/profile
 * Update the student's profile (avatar, name, language, proficiency).
 */
export async function PUT(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
    const { name, avatarUrl, languageToLearn, proficiencyLevel } = body;

    const updateData: Partial<StudentProfileUpdate> = {};
    if (name !== undefined) updateData.name = name;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (languageToLearn !== undefined) updateData.languageToLearn = languageToLearn;
    if (proficiencyLevel !== undefined) {
      updateData.proficiencyLevel = proficiencyLevel.toUpperCase();
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No fields to update." }, { status: 400 });
    }

    const profile = await db.studentProfile.update({
      where: { userId: auth.user.sub },
      data: updateData,
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/students/profile error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

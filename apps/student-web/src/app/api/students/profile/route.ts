import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { validateProfileUpdate } from "@/lib/validation";
import { exceedsMaxBodySize, rateLimitRedis } from "@/lib/rate-limit";

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

  if (exceedsMaxBodySize(request)) {
    return NextResponse.json({ message: "Request body too large." }, { status: 413 });
  }

  const isLimited = await rateLimitRedis(auth.user.sub, "profile-update", { windowMs: 60_000, max: 60 });
  if (isLimited) {
    return NextResponse.json({ message: "Too many requests. Please try again later." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const validation = validateProfileUpdate(body);
  if (!validation.ok) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: validation.errors[0], errors: validation.errors },
      { status: 400 }
    );
  }

  try {
    const profile = await db.studentProfile.update({
      where: { userId: auth.user.sub },
      data: validation.data,
    });

    return NextResponse.json({ profile }, { status: 200 });
  } catch (err) {
    console.error("PUT /api/students/profile error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { db } from "@/lib/db";

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's full profile data by reading and verifying
 * the lm_access_token httpOnly cookie.
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("lm_access_token")?.value;

  if (!accessToken) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload?.sub) {
    const res = NextResponse.json({ user: null }, { status: 200 });
    res.cookies.set("lm_access_token", "", { maxAge: 0, path: "/" });
    return res;
  }

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      role: true,
      emailVerified: true,
      studentProfile: {
        select: {
          name: true,
          avatarUrl: true,
          languageToLearn: true,
          proficiencyLevel: true,
          onboardingComplete: true,
          status: true,
        },
      },
      teacherProfile: {
        select: {
          name: true,
          avatarUrl: true,
          bio: true,
          gender: true,
          language: true,
          experienceLevel: true,
          onboardingComplete: true,
          status: true,
        },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ user: null }, { status: 200 });
  }

  const profile = user.role === "STUDENT" ? user.studentProfile : user.teacherProfile;

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        emailVerified: user.emailVerified,
        name: profile?.name ?? "User",
        avatarUrl: profile?.avatarUrl ?? null,
        onboardingComplete: profile?.onboardingComplete ?? false,
        profile:
          user.role === "STUDENT"
            ? {
                languageToLearn: user.studentProfile?.languageToLearn ?? "",
                proficiencyLevel: user.studentProfile?.proficiencyLevel ?? "BEGINNER",
                status: user.studentProfile?.status ?? "ACTIVE",
              }
            : {
                bio: user.teacherProfile?.bio ?? "",
                gender: user.teacherProfile?.gender ?? "",
                language: user.teacherProfile?.language ?? "",
                experienceLevel: user.teacherProfile?.experienceLevel ?? "FRESHER",
                status: user.teacherProfile?.status ?? "PENDING",
              },
      },
    },
    { status: 200 }
  );
}

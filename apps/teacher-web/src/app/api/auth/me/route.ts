import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { db } from "@/lib/db";

type MeRow = {
  id: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  emailVerified: boolean;
  studentProfile: {
    name: string;
    avatarUrl: string | null;
    languageToLearn: string;
    proficiencyLevel: string;
    onboardingComplete: boolean;
    status: string;
    hasDateOfBirth: boolean;
  } | null;
  teacherProfile: {
    name: string;
    avatarUrl: string | null;
    bio: string | null;
    gender: string | null;
    language: string | null;
    experienceLevel: string;
    onboardingComplete: boolean;
    status: string;
    hasDateOfBirth: boolean;
  } | null;
};

/**
 * GET /api/auth/me
 *
 * Returns the authenticated user's full profile data by reading and verifying
 * the lm_access_token httpOnly cookie.
 */
export async function GET(request: NextRequest) {
  try {
    const accessToken = request.cookies.get("lm_teacher_access_token")?.value;

    if (!accessToken) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const payload = await verifyAccessToken(accessToken);
    if (!payload?.sub) {
      const res = NextResponse.json({ user: null }, { status: 200 });
      res.cookies.set("lm_teacher_access_token", "", { maxAge: 0, path: "/" });
      return res;
    }

    // One round trip instead of three (user + each profile): every signed-in
    // page waits on this before it renders.
    const [row] = await db.$queryRaw<MeRow[]>`
      SELECT u.id, u.email, u.role::text AS role, u."emailVerified",
             CASE WHEN sp."userId" IS NULL THEN NULL ELSE json_build_object(
               'name', sp.name, 'avatarUrl', sp."avatarUrl", 'languageToLearn', sp."languageToLearn",
               'proficiencyLevel', sp."proficiencyLevel", 'onboardingComplete', sp."onboardingComplete",
               'status', sp.status, 'hasDateOfBirth', sp."dateOfBirth" IS NOT NULL) END AS "studentProfile",
             CASE WHEN tp."userId" IS NULL THEN NULL ELSE json_build_object(
               'name', tp.name, 'avatarUrl', tp."avatarUrl", 'bio', tp.bio, 'gender', tp.gender,
               'language', tp.language, 'experienceLevel', tp."experienceLevel",
               'onboardingComplete', tp."onboardingComplete", 'status', tp.status,
               'hasDateOfBirth', tp."dateOfBirth" IS NOT NULL) END AS "teacherProfile"
        FROM "User" u
        LEFT JOIN "StudentProfile" sp ON sp."userId" = u.id
        LEFT JOIN "TeacherProfile" tp ON tp."userId" = u.id
       WHERE u.id = ${payload.sub}::uuid
    `;
    const user = row ?? null;

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
          // Accounts created before DOB collection are asked for it on login.
          needsDateOfBirth: !!profile && !profile.hasDateOfBirth,
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
  } catch (err) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

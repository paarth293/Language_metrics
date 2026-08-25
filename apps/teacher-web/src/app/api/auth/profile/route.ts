import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { db } from "@/lib/db";

const SUPPORTED_LANGUAGES = [
  "English", "Spanish", "French", "German", "Italian", "Portuguese",
  "Japanese", "Korean", "Mandarin Chinese", "Arabic", "Hindi", "Russian",
  "Dutch", "Swedish", "Turkish", "Polish", "Vietnamese", "Thai",
];

/**
 * GET /api/auth/profile — Fetch the user's full profile
 * PATCH /api/auth/profile — Update the user's profile
 */
export async function GET(request: NextRequest) {
  const accessToken = request.cookies.get("lm_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const profile = user.role === "STUDENT" ? user.studentProfile : user.teacherProfile;

  return NextResponse.json({
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    name: profile?.name ?? "",
    avatarUrl: profile?.avatarUrl ?? null,
    onboardingComplete: profile?.onboardingComplete ?? false,
    ...(user.role === "STUDENT"
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
        }),
  });
}

export async function PATCH(request: NextRequest) {
  const accessToken = request.cookies.get("lm_access_token")?.value;
  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await verifyAccessToken(accessToken);
  if (!payload?.sub) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, role } = body;

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    return NextResponse.json({ error: "Name must be at least 2 characters." }, { status: 400 });
  }

  try {
    if (role === "STUDENT") {
      const { languageToLearn, proficiencyLevel } = body;

      if (!languageToLearn || !SUPPORTED_LANGUAGES.includes(languageToLearn)) {
        return NextResponse.json({ error: "Please select a valid language to learn." }, { status: 400 });
      }

      const validLevels = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
      if (!proficiencyLevel || !validLevels.includes(proficiencyLevel)) {
        return NextResponse.json({ error: "Please select a valid proficiency level." }, { status: 400 });
      }

      await db.studentProfile.update({
        where: { userId: payload.sub },
        data: {
          name: name.trim(),
          languageToLearn,
          proficiencyLevel: proficiencyLevel as "BEGINNER" | "INTERMEDIATE" | "ADVANCED",
        },
      });
    } else if (role === "TEACHER") {
      const { language, bio, gender, experienceLevel } = body;

      if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
        return NextResponse.json({ error: "Please select a valid teaching language." }, { status: 400 });
      }

      await db.teacherProfile.update({
        where: { userId: payload.sub },
        data: {
          name: name.trim(),
          language,
          bio: bio?.trim() ?? null,
          gender: gender?.trim() ?? null,
          experienceLevel: (experienceLevel as "FRESHER" | "EXPERIENCED") ?? undefined,
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Profile] Failed to update profile:", err);
    return NextResponse.json({ error: "Failed to update profile. Please try again." }, { status: 500 });
  }
}

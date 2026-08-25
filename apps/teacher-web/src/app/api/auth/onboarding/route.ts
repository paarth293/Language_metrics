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
 * POST /api/auth/onboarding
 * Saves the user's profile details collected during onboarding and
 * marks onboardingComplete = true.
 */
export async function POST(request: NextRequest) {
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
          onboardingComplete: true,
        },
      });
    } else if (role === "TEACHER") {
      const { language, bio, gender, experienceLevel } = body;

      if (!language || !SUPPORTED_LANGUAGES.includes(language)) {
        return NextResponse.json({ error: "Please select a valid teaching language." }, { status: 400 });
      }

      const validExp = ["FRESHER", "EXPERIENCED"];
      if (!experienceLevel || !validExp.includes(experienceLevel)) {
        return NextResponse.json({ error: "Please select experience level." }, { status: 400 });
      }

      await db.teacherProfile.update({
        where: { userId: payload.sub },
        data: {
          name: name.trim(),
          language,
          bio: bio?.trim() ?? null,
          gender: gender?.trim() ?? null,
          experienceLevel: experienceLevel as "FRESHER" | "EXPERIENCED",
          onboardingComplete: true,
        },
      });
    } else {
      return NextResponse.json({ error: "Invalid role." }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Onboarding] Failed to save profile:", err);
    return NextResponse.json({ error: "Failed to save profile. Please try again." }, { status: 500 });
  }
}

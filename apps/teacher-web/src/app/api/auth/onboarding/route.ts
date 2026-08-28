import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/tokens";
import { db } from "@/lib/db";
import { TEACHING_LANGUAGES } from "@/lib/languages";

const SUPPORTED_LANGUAGE_CODES = TEACHING_LANGUAGES.map((l) => l.code);

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

      if (!languageToLearn || !SUPPORTED_LANGUAGE_CODES.includes(languageToLearn)) {
        return NextResponse.json({ error: "Please select a valid language to learn." }, { status: 400 });
      }

      if (!proficiencyLevel || typeof proficiencyLevel !== "string" || proficiencyLevel.length > 50) {
        return NextResponse.json({ error: "Please select a valid proficiency level." }, { status: 400 });
      }

      await db.studentProfile.update({
        where: { userId: payload.sub },
        data: {
          name: name.trim(),
          languageToLearn,
          proficiencyLevel: proficiencyLevel.toUpperCase(),
          onboardingComplete: true,
        },
      });
    } else if (role === "TEACHER") {
      const { language, languages, bio, gender, experienceLevel, qualificationDocUrl, idProofDocUrl, experienceDocUrl } = body;

      if (!language || !SUPPORTED_LANGUAGE_CODES.includes(language)) {
        return NextResponse.json({ error: "Please select a valid primary teaching language." }, { status: 400 });
      }

      // Validate languages array
      if (!Array.isArray(languages) || languages.length === 0) {
        return NextResponse.json({ error: "Please select at least one language." }, { status: 400 });
      }
      const invalidLangs = languages.filter((l: string) => !SUPPORTED_LANGUAGE_CODES.includes(l));
      if (invalidLangs.length > 0) {
        return NextResponse.json({ error: `Invalid language codes: ${invalidLangs.join(", ")}` }, { status: 400 });
      }

      const validExp = ["FRESHER", "EXPERIENCED"];
      if (!experienceLevel || !validExp.includes(experienceLevel)) {
        return NextResponse.json({ error: "Please select experience level." }, { status: 400 });
      }

      // Validate required document URLs
      if (!qualificationDocUrl || typeof qualificationDocUrl !== "string" || !qualificationDocUrl.startsWith("/uploads/")) {
        return NextResponse.json({ error: "Please upload your qualification certificate." }, { status: 400 });
      }
      if (!idProofDocUrl || typeof idProofDocUrl !== "string" || !idProofDocUrl.startsWith("/uploads/")) {
        return NextResponse.json({ error: "Please upload your ID proof." }, { status: 400 });
      }

      // If experienced, experience doc is required
      if (experienceLevel === "EXPERIENCED" && (!experienceDocUrl || typeof experienceDocUrl !== "string" || !experienceDocUrl.startsWith("/uploads/"))) {
        return NextResponse.json({ error: "Please upload your experience document." }, { status: 400 });
      }

      // Build document records
      const documentsToCreate = [
        { type: "EDUCATION" as const, url: qualificationDocUrl, status: "PENDING" as const },
        { type: "ID_PROOF" as const, url: idProofDocUrl, status: "PENDING" as const },
        ...(experienceDocUrl ? [{ type: "EXPERIENCE_LETTER" as const, url: experienceDocUrl, status: "PENDING" as const }] : []),
      ];

      await db.teacherProfile.update({
        where: { userId: payload.sub },
        data: {
          name: name.trim(),
          language,
          languages: languages || [language],
          bio: bio?.trim() ?? null,
          gender: gender?.trim() ?? null,
          experienceLevel: experienceLevel as "FRESHER" | "EXPERIENCED",
          onboardingComplete: true,
          documents: {
            create: documentsToCreate,
          },
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

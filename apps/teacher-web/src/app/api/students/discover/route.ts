import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withCache } from "@/lib/api-cache";
import { getLanguageAliases, getLanguageDisplayName } from "@/lib/languages";

/** Mirrors the TeacherExperienceLevel enum in schema.prisma. */
const EXPERIENCE_LEVELS = ["FRESHER", "EXPERIENCED"] as const;
type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * Matches a teacher whose primary or additional languages include any
 * spelling of `value` — stored values are a mix of ISO codes and names.
 */
function languageClauses(value: string, mode: "equals" | "contains") {
  const aliases = getLanguageAliases(value);
  return [
    ...aliases.map((a) => ({ language: { [mode]: a, mode: "insensitive" as const } })),
    { languages: { hasSome: aliases } },
  ];
}

/**
 * GET /api/students/discover
 * Returns approved teachers with their rates, ratings, and availability.
 * Supports search and filter query params.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  // Cache key based on query params
  const url = new URL(request.url);
  const cacheKey = `discover:${url.searchParams.toString()}`;

  return withCache(cacheKey, 60_000, async () => {
  try {
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() || "";
    const language = url.searchParams.get("language")?.trim() || "";
    // Budget arrives in rupees; TeacherRate.amount is stored in paise.
    const minRate = url.searchParams.get("minRate");
    const maxRate = url.searchParams.get("maxRate");
    const experience = url.searchParams.get("experience")?.trim().toUpperCase();
    const gender = url.searchParams.get("gender")?.trim();
    const availableOnly = url.searchParams.get("available") === "true";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    if (experience && !EXPERIENCE_LEVELS.includes(experience as ExperienceLevel)) {
      return NextResponse.json(
        { message: `experience must be one of: ${EXPERIENCE_LEVELS.join(", ")}.` },
        { status: 400 }
      );
    }

    // Build where clause. Each active filter is its own AND entry so none
    // of them overwrite another's OR.
    type WhereInput = NonNullable<NonNullable<Parameters<typeof db.teacherProfile.findMany>[0]>["where"]>;
    const and: WhereInput[] = [];
    const where: WhereInput = {
      status: "APPROVED",
      onboardingComplete: true,
    };

    if (search) {
      and.push({
        OR: [{ name: { contains: search, mode: "insensitive" } }, ...languageClauses(search, "contains")],
      });
    }

    if (language) {
      and.push({ OR: languageClauses(language, "equals") });
    }

    if (experience) {
      where.experienceLevel = experience as ExperienceLevel;
    }

    // Gender is free text: registration saves "male", onboarding saves "Male".
    if (gender) {
      where.gender = { equals: gender, mode: "insensitive" };
    }

    if (availableOnly) {
      and.push({ availability: { some: {} } });
    }

    if (minRate !== null || maxRate !== null) {
      const gte = Math.max(0, parseInt(minRate || "0") || 0) * 100;
      const lte = maxRate !== null ? (parseInt(maxRate) || 0) * 100 : undefined;
      const priceOr: WhereInput[] = [
        { rates: { some: { type: "HOURLY", amount: { gte, ...(lte !== undefined && { lte }) } } } },
      ];
      // A teacher with no HOURLY rate is priced at 0, as in student-web.
      if (gte === 0) priceOr.push({ rates: { none: { type: "HOURLY" } } });
      and.push({ OR: priceOr });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const teachers = await db.teacherProfile.findMany({
      where,
      include: {
        user: {
          select: { email: true },
        },
        rates: {
          select: { type: true, amount: true },
        },
        availability: {
          select: { dayOfWeek: true, startTime: true, endTime: true },
        },
        reviews: {
          select: { rating: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    // Calculate ratings and format response
    const formattedTeachers = teachers.map((t) => {
      const avgRating =
        t.reviews.length > 0
          ? t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length
          : 0;

      // Rates are stored in paise; the discover UI shows and filters in rupees.
      const hourlyRate = (t.rates.find((r) => r.type === "HOURLY")?.amount || 0) / 100;
      const demoRate = 29; // Fixed demo rate in coins

      // Find next available slot
      const now = new Date();
      const currentDay = now.getDay();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();

      let nextAvailable = "Available";
      const todaySlots = t.availability.filter((a) => a.dayOfWeek === currentDay);
      for (const slot of todaySlots) {
        const [startHour, startMin] = slot.startTime.split(":").map(Number);
        if (startHour > currentHour || (startHour === currentHour && startMin > currentMinutes)) {
          nextAvailable = `Today, ${slot.startTime}`;
          break;
        }
      }

      if (nextAvailable === "Available") {
        // Find next day with availability
        for (let i = 1; i <= 7; i++) {
          const daySlots = t.availability.filter(
            (a) => a.dayOfWeek === (currentDay + i) % 7
          );
          if (daySlots.length > 0) {
            const dayName = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
              (currentDay + i) % 7
            ];
            nextAvailable = `${dayName}, ${daySlots[0].startTime}`;
            break;
          }
        }
      }

      return {
        id: t.userId,
        name: t.name,
        avatar: t.avatarUrl,
        languages: Array.from(
          new Set([t.language, ...(t.languages || [])].filter((l): l is string => !!l).map(getLanguageDisplayName))
        ),
        rating: Math.round(avgRating * 10) / 10,
        reviews: t.reviews.length,
        hourlyRate,
        demoRate,
        headline: t.bio || `Experienced ${t.language || "language"} teacher`,
        nextAvailable,
        experienceLevel: t.experienceLevel,
        availability: t.availability.length > 0,
      };
    });

    return NextResponse.json({ teachers: formattedTeachers }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/discover error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
  }); // close withCache
}

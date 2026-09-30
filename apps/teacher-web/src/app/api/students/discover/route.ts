import { NextResponse } from "next/server";
import { DEMO_CLASS_COINS } from "@repo/live-classes";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withCache } from "@/lib/api-cache";
import { getLanguageAliases, getLanguageDisplayName } from "@/lib/languages";
import { convertBudgetRangeToAllCurrencies, convertMinorUnitsSafe, getCurrencyInfo } from "@repo/currency";

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

  // Every rate is shown converted into the viewing student's own currency,
  // so the cache key must vary by it too — otherwise the first student's
  // conversion would be served, unconverted assumptions and all, to the
  // next student who prefers a different currency.
  const student = await db.studentProfile.findUnique({
    where: { userId: auth.user.sub },
    select: { preferredCurrency: true },
  });
  const studentCurrency = student?.preferredCurrency || "INR";

  const url = new URL(request.url);
  const cacheKey = `discover:${url.searchParams.toString()}:cur=${studentCurrency}`;

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
      // Budget bounds arrive in the student's own currency, but each teacher's
      // rate is stored in whichever currency *they* chose — so the bounds are
      // converted into every supported currency first, and matched per-currency.
      const minMajor = minRate !== null ? Math.max(0, parseInt(minRate) || 0) : undefined;
      const maxMajor = maxRate !== null ? parseInt(maxRate) || 0 : undefined;
      const perCurrency = await convertBudgetRangeToAllCurrencies(minMajor, maxMajor, studentCurrency);
      const priceOr: WhereInput[] = perCurrency.map(({ currency, gte, lte }) => ({
        rates: { some: { type: "HOURLY", currency, amount: { ...(gte !== undefined && { gte }), ...(lte !== undefined && { lte }) } } },
      }));
      // A teacher with no HOURLY rate is priced at 0, as in student-web.
      if (minMajor === undefined || minMajor === 0) priceOr.push({ rates: { none: { type: "HOURLY" } } });
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
          select: { type: true, amount: true, currency: true },
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
    const formattedTeachers = await Promise.all(teachers.map(async (t) => {
      const avgRating =
        t.reviews.length > 0
          ? t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length
          : 0;

      // Stored in the teacher's own currency, minor units; converted to
      // whatever the viewing student prefers before it's ever shown.
      const rawRate = t.rates.find((r) => r.type === "HOURLY");
      const { amount: convertedMinor, currency: shownCurrency } = rawRate
        ? await convertMinorUnitsSafe(rawRate.amount, rawRate.currency, studentCurrency)
        : { amount: 0, currency: studentCurrency };
      const hourlyRate = convertedMinor / 10 ** getCurrencyInfo(shownCurrency).decimals;
      const demoRate = DEMO_CLASS_COINS;

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
        currency: shownCurrency,
        demoRate,
        // Only the teacher's own words. The old fallback invented
        // "Experienced <code> teacher", mislabelling freshers.
        headline: t.bio?.trim() || null,
        nextAvailable,
        experienceLevel: t.experienceLevel,
        availability: t.availability.length > 0,
      };
    }));

    return NextResponse.json({ teachers: formattedTeachers, currency: studentCurrency }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/discover error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
  }); // close withCache
}

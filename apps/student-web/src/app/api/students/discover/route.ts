import { NextResponse } from "next/server";
import { DEMO_CLASS_COINS } from "@repo/live-classes";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withCache } from "@/lib/api-cache";
import { getLanguageDisplayName } from "@/lib/languages";
import { validateDiscoverQuery } from "@/lib/validation";
import { buildDiscoverWhere, paginate } from "@/lib/discover-query";
import { sanitizeOrFallback } from "@/lib/sanitize";
import { convertBudgetRangeToAllCurrencies, convertMinorUnitsSafe, getCurrencyInfo } from "@repo/currency";

export const dynamic = "force-dynamic";

/**
 * GET /api/students/discover
 * Returns approved teachers with their rates, ratings, and availability.
 * Supports search, filter, price-range, and cursor-based pagination query
 * params.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request, "STUDENT");
  if (auth.error) return auth.error;

  const url = new URL(request.url);

  const validation = validateDiscoverQuery(url.searchParams);
  if (!validation.ok) {
    return NextResponse.json(
      { code: "VALIDATION_ERROR", message: "Invalid query parameters.", errors: validation.errors },
      { status: 400 }
    );
  }
  const query = validation.data;

  // Every rate is shown converted into the viewing student's own currency,
  // so the cache key must vary by it too — otherwise the first student's
  // conversion would be served, unconverted assumptions and all, to the
  // next student who prefers a different currency.
  const student = await db.studentProfile.findUnique({
    where: { userId: auth.user.sub },
    select: { preferredCurrency: true },
  });
  const studentCurrency = student?.preferredCurrency || "INR";

  // Budget bounds arrive in the student's currency (query.minPrice/maxPrice
  // are already minor units of it — see validateDiscoverQuery); fan them out
  // across every supported currency so a teacher pricing in USD (say) is
  // matched against USD-converted bounds rather than the raw INR-assumed
  // numbers.
  const priceRangeIsDefault = query.minPrice === 0 && query.maxPrice === 99_999;
  const studentDecimals = getCurrencyInfo(studentCurrency).decimals;
  const perCurrencyBounds = priceRangeIsDefault
    ? undefined
    : await convertBudgetRangeToAllCurrencies(
        query.minPrice / 10 ** studentDecimals,
        query.maxPrice / 10 ** studentDecimals,
        studentCurrency
      );

  // Cache key based on the *validated* query params, so two query strings
  // that normalize to the same request (e.g. differing only in whitespace)
  // share a cache entry instead of needlessly missing.
  const cacheKey = `discover:${JSON.stringify(query)}:cur=${studentCurrency}`;

  return withCache(cacheKey, 60_000, async () => {
    try {
      const where = buildDiscoverWhere(query, perCurrencyBounds);

      // Fetch one extra row so we can tell whether another page exists
      // without a second COUNT query (see lib/discover-query.ts#paginate).
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
        take: query.limit + 1,
        skip: query.cursor ? 1 : 0,
        ...(query.cursor ? { cursor: { userId: query.cursor } } : {}),
      });

      const page = paginate(teachers, query.limit);

      // Calculate ratings and format response
      const formattedTeachers = await Promise.all(page.items.map(async (t) => {
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
          // Sanitized defense-in-depth: React's JSX text interpolation
          // already escapes these on the two pages that render them today
          // (discover/page.tsx and teacher/[id]/page.tsx — verified by
          // reading both), so this isn't currently exploitable through the
          // web UI. It's still worth stripping at the API boundary so any
          // *other* consumer of this JSON (a future mobile app, an admin
          // export, a future `dangerouslySetInnerHTML` refactor) can't be
          // handed a stored HTML/script payload. See errors.md.
          name: sanitizeOrFallback(t.name, ""),
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
          headline: sanitizeOrFallback(t.bio, "").trim() || null,
          nextAvailable,
          experienceLevel: t.experienceLevel,
          availability: t.availability.length > 0,
        };
      }));

      return NextResponse.json(
        {
          teachers: formattedTeachers,
          currency: studentCurrency,
          pagination: { nextCursor: page.nextCursor, hasMore: page.hasMore },
        },
        { status: 200 }
      );
    } catch (err) {
      console.error("GET /api/students/discover error:", err);
      return NextResponse.json({ message: "Internal server error." }, { status: 500 });
    }
  });
}

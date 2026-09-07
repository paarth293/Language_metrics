import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withCache } from "@/lib/api-cache";
import { validateDiscoverQuery } from "@/lib/validation";
import { buildDiscoverWhere, paginate } from "@/lib/discover-query";
import { sanitizeOrFallback } from "@/lib/sanitize";

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

  // Cache key based on the *validated* query params, so two query strings
  // that normalize to the same request (e.g. differing only in whitespace)
  // share a cache entry instead of needlessly missing.
  const cacheKey = `discover:${JSON.stringify(query)}`;

  return withCache(cacheKey, 60_000, async () => {
    try {
      const where = buildDiscoverWhere(query);

      // Fetch one extra row so we can tell whether another page exists
      // without a second COUNT query (see lib/discover-query.ts#paginate).
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
        take: query.limit + 1,
        skip: query.cursor ? 1 : 0,
        ...(query.cursor ? { cursor: { userId: query.cursor } } : {}),
      });

      const page = paginate(teachers, query.limit);

      // Calculate ratings and format response
      const formattedTeachers = page.items.map((t) => {
        const avgRating =
          t.reviews.length > 0
            ? t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length
            : 0;

        const hourlyRate = t.rates.find((r) => r.type === "HOURLY")?.amount || 0;
        const demoRate = 49; // Fixed demo rate in coins

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
          languages: [t.language, ...(t.languages || [])].filter(Boolean),
          rating: Math.round(avgRating * 10) / 10,
          reviews: t.reviews.length,
          hourlyRate,
          demoRate,
          headline: sanitizeOrFallback(t.bio, `Experienced ${t.language || "language"} teacher`),
          nextAvailable,
          experienceLevel: t.experienceLevel,
          availability: t.availability.length > 0,
        };
      });

      return NextResponse.json(
        {
          teachers: formattedTeachers,
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

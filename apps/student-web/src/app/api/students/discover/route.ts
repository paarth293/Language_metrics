import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { withCache } from "@/lib/api-cache";

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
    const search = url.searchParams.get("search") || "";
    const language = url.searchParams.get("language") || "";
    const minPrice = parseInt(url.searchParams.get("minPrice") || "0");
    const maxPrice = parseInt(url.searchParams.get("maxPrice") || "99999");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    // Build where clause
    const where: any = {
      status: "APPROVED",
      onboardingComplete: true,
    };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { language: { contains: search, mode: "insensitive" } },
        { languages: { has: search } },
      ];
    }

    if (language) {
      where.OR = [
        { language: { equals: language, mode: "insensitive" } },
        { languages: { has: language } },
      ];
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
        name: t.name,
        avatar: t.avatarUrl,
        languages: [t.language, ...(t.languages || [])].filter(Boolean),
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

    // Filter by price if specified
    const filtered = formattedTeachers.filter(
      (t) => t.hourlyRate >= minPrice && t.hourlyRate <= maxPrice
    );

    return NextResponse.json({ teachers: filtered }, { status: 200 });
  } catch (err) {
    console.error("GET /api/students/discover error:", err);
    return NextResponse.json({ message: "Internal server error." }, { status: 500 });
  }
  }); // close withCache
}

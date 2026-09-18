import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  TeacherSearchQuerySchema,
  TeacherSearchResponseSchema,
  type TeacherSearchResponse,
} from "@repo/api-contracts";

/**
 * GET /api/v1/teachers
 *
 * Mobile endpoint for teacher discovery, language filtering, and search.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const rawQuery = {
    language: url.searchParams.get("language") ?? undefined,
    search: url.searchParams.get("search") ?? undefined,
    minPrice: url.searchParams.get("minPrice") ?? undefined,
    maxPrice: url.searchParams.get("maxPrice") ?? undefined,
    rating: url.searchParams.get("rating") ?? undefined,
    page: url.searchParams.get("page") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  };

  const parseResult = TeacherSearchQuerySchema.safeParse(rawQuery);
  if (!parseResult.success) {
    return NextResponse.json(
      { message: "Invalid query parameters.", errors: parseResult.error.issues },
      { status: 400 }
    );
  }
  const query = parseResult.data;

  try {
    const skip = (query.page - 1) * query.limit;

    // Prisma query for approved teachers
    const whereClause: Record<string, unknown> = {
      status: "APPROVED",
    };

    if (query.language && query.language !== "All") {
      whereClause.languages = {
        has: query.language,
      };
    }

    if (query.search) {
      whereClause.OR = [
        { name: { contains: query.search, mode: "insensitive" } },
        { bio: { contains: query.search, mode: "insensitive" } },
      ];
    }

    const [teachers, total] = await Promise.all([
      db.teacherProfile.findMany({
        where: whereClause,
        include: {
          rates: true,
          reviews: {
            select: { rating: true },
          },
        },
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
      }),
      db.teacherProfile.count({ where: whereClause }),
    ]);

    const formattedTeachers = teachers.map((t) => {
      const hourlyRate = t.rates?.[0]?.amount ? Math.round(Number(t.rates[0].amount)) : 500;
      const avgRating =
        t.reviews.length > 0
          ? Number((t.reviews.reduce((acc, r) => acc + r.rating, 0) / t.reviews.length).toFixed(2))
          : 5.0;

      return {
        id: t.userId,
        name: t.name,
        avatarUrl: t.avatarUrl ?? null,
        headline: t.bio ? t.bio.slice(0, 80) : null,
        languages: t.languages,
        hourlyRate,
        rating: avgRating,
        totalReviews: t.reviews.length,
        totalLessons: 0,
        isVerified: true,
      };
    });

    const responsePayload: TeacherSearchResponse = {
      teachers: formattedTeachers,
      pagination: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };

    const validated = TeacherSearchResponseSchema.parse(responsePayload);
    return NextResponse.json(validated, { status: 200 });
  } catch (error) {
    console.error("[Mobile API] Teacher search error:", error);
    return NextResponse.json({ message: "Failed to search teachers." }, { status: 500 });
  }
}

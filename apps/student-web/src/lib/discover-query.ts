/**
 * lib/discover-query.ts — pure helpers for GET /api/students/discover.
 *
 * Pulled out of the route handler so the two trickiest pieces of that
 * endpoint — building the Prisma `where` clause and slicing a
 * cursor-paginated page — are plain functions that can be unit tested
 * without Next.js, Prisma, or a database (see discover-query.test.ts).
 */

import type { DiscoverQuery } from "./validation";

/**
 * Builds the Prisma `where` clause for TeacherProfile.findMany() from a
 * validated discover query.
 *
 * Two bugs in the original inline version this replaces:
 *
 * 1. Search + language clobbering: the old code did
 *      if (search)   where.OR = [...]
 *      if (language) where.OR = [...]
 *    Both branches assigned the SAME `where.OR` key, so if a caller passed
 *    both `search` and `language`, the language branch silently overwrote
 *    the search branch — a request for "Spanish teachers matching search
 *    'kids'" would search only by language and drop the "kids" filter with
 *    no error. Fixed by combining every active filter as a separate entry
 *    in `where.AND`, so each one narrows the result set instead of
 *    replacing the previous one.
 *
 * 2. Price filtering happened in application code, after fetching every
 *    matching teacher from the database (`formattedTeachers.filter(...)`).
 *    That doesn't scale, and it can't be paginated correctly either (a
 *    page of `limit` teachers fetched from the DB might all get filtered
 *    out by price, silently returning fewer than `limit` results, or none,
 *    even though matching teachers exist further down). Fixed by pushing
 *    the price range into the query itself via the `rates` relation.
 *    A teacher with no HOURLY rate row at all is treated as priced at 0
 *    (matching the original `t.rates.find(...)?.amount || 0` fallback), so
 *    they're only included when the caller's range covers 0.
 */
export function buildDiscoverWhere(query: DiscoverQuery): Record<string, unknown> {
  const where: Record<string, unknown> = {
    status: "APPROVED",
    onboardingComplete: true,
  };

  const and: Record<string, unknown>[] = [];

  if (query.search) {
    and.push({
      OR: [
        { name: { contains: query.search, mode: "insensitive" } },
        { language: { contains: query.search, mode: "insensitive" } },
        { languages: { has: query.search } },
      ],
    });
  }

  if (query.language) {
    and.push({
      OR: [
        { language: { equals: query.language, mode: "insensitive" } },
        { languages: { has: query.language } },
      ],
    });
  }

  const priceRangeIsDefault = query.minPrice === 0 && query.maxPrice === 99_999;
  if (!priceRangeIsDefault) {
    const priceOr: Record<string, unknown>[] = [
      {
        rates: {
          some: {
            type: "HOURLY",
            amount: { gte: query.minPrice, lte: query.maxPrice },
          },
        },
      },
    ];
    // Preserve the old "no rate row => treated as free (0)" behavior only
    // when 0 is actually inside the requested range.
    if (query.minPrice <= 0) {
      priceOr.push({ rates: { none: { type: "HOURLY" } } });
    }
    and.push({ OR: priceOr });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * Slices a cursor-paginated page out of a Prisma result fetched with
 * `take: limit + 1` (one extra row so we can tell whether more pages exist
 * without a second COUNT query).
 */
export function paginate<T extends { userId: string }>(
  fetched: T[],
  limit: number
): CursorPage<T> {
  const hasMore = fetched.length > limit;
  const items = hasMore ? fetched.slice(0, limit) : fetched;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor: hasMore && last ? last.userId : null,
    hasMore,
  };
}

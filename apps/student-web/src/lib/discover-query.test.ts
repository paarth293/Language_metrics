import { test, expect } from "vitest";
import { buildDiscoverWhere, paginate } from "./discover-query";
import type { DiscoverQuery } from "./validation";

function check(cond: boolean, label: string, _detail?: unknown) {
  test(label, () => {
    expect(cond).toBe(true);
  });
}

function baseQuery(overrides: Partial<DiscoverQuery> = {}): DiscoverQuery {
  return { minPrice: 0, maxPrice: 99_999, limit: 20, ...overrides };
}

// ── buildDiscoverWhere ──────────────────────────────────────────────────

{
  const where = buildDiscoverWhere(baseQuery());
  check(
    where.status === "APPROVED" && where.onboardingComplete === true && where.AND === undefined,
    "where: no filters -> base clause only, no AND",
    where
  );
}

{
  // This is the exact clobbering bug fixed: both search AND language must
  // survive together as separate AND-ed conditions, not overwrite each other.
  const where = buildDiscoverWhere(baseQuery({ search: "kids", language: "Spanish" })) as any;
  check(Array.isArray(where.AND) && where.AND.length === 2, "where: search+language both present as separate AND entries", where);
  const hasSearchClause = where.AND.some((c: any) =>
    JSON.stringify(c).includes("kids")
  );
  const hasLanguageClause = where.AND.some((c: any) =>
    JSON.stringify(c).includes("Spanish")
  );
  check(hasSearchClause, "where: search term present in AND clauses", where);
  check(hasLanguageClause, "where: language term present in AND clauses", where);
}

{
  // Price range narrower than the full default range must push a rates
  // filter into the query.
  const where = buildDiscoverWhere(baseQuery({ minPrice: 100, maxPrice: 500 })) as any;
  check(Array.isArray(where.AND) && where.AND.length === 1, "where: narrowed price range adds one AND entry", where);
  const priceClause = where.AND[0];
  check(
    JSON.stringify(priceClause).includes('"gte":100') && JSON.stringify(priceClause).includes('"lte":500'),
    "where: price range values present",
    priceClause
  );
}

{
  // Re-check the minPrice>0 case precisely: the "no HOURLY rate" fallback
  // must be absent (only present when minPrice<=0, since a teacher with no
  // rate at all is treated as priced at 0).
  const where = buildDiscoverWhere(baseQuery({ minPrice: 100, maxPrice: 500 })) as any;
  const priceOr = where.AND[0].OR;
  check(priceOr.length === 1, "where: minPrice>0 excludes the no-rate fallback branch", priceOr);
}

{
  const where = buildDiscoverWhere(baseQuery({ minPrice: 0, maxPrice: 500 })) as any;
  const priceOr = where.AND[0].OR;
  check(priceOr.length === 2, "where: minPrice=0 includes the no-rate fallback branch (preserves old default-inclusive behavior)", priceOr);
}

// ── paginate ────────────────────────────────────────────────────────────

{
  const fetched = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
  const page = paginate(fetched, 5);
  check(page.items.length === 3 && page.hasMore === false && page.nextCursor === null, "paginate: fewer results than limit -> no more pages", page);
}

{
  // Simulate fetching limit+1=3 rows for a limit of 2.
  const fetched = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
  const page = paginate(fetched, 2);
  check(page.items.length === 2, "paginate: trims to `limit` items", page);
  check(page.hasMore === true, "paginate: hasMore true when extra row was fetched", page);
  check(page.nextCursor === "b", "paginate: nextCursor is the last item ON the returned page, not the extra lookahead row", page);
}

{
  const page = paginate([], 20);
  check(page.items.length === 0 && page.hasMore === false && page.nextCursor === null, "paginate: empty result set handled", page);
}

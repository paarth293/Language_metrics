import { describe, it, expect } from "vitest";
import { buildDiscoverWhere, paginate } from "./discover-query";
import type { DiscoverQuery } from "./validation";

function baseQuery(overrides: Partial<DiscoverQuery> = {}): DiscoverQuery {
  return { minPrice: 0, maxPrice: 99_999, limit: 20, ...overrides };
}

describe("discover-query", () => {
  it("where: no filters -> base clause only, no AND", () => {
    const where = buildDiscoverWhere(baseQuery());
    expect(where.status).toBe("APPROVED");
    expect(where.onboardingComplete).toBe(true);
    expect(where.AND).toBeUndefined();
  });

  it("where: search+language both present as separate AND entries", () => {
    const where = buildDiscoverWhere(baseQuery({ search: "kids", language: "Spanish" })) as any;
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND.length).toBe(2);
    const hasSearchClause = where.AND.some((c: any) =>
      JSON.stringify(c).includes("kids")
    );
    const hasLanguageClause = where.AND.some((c: any) =>
      JSON.stringify(c).includes("Spanish")
    );
    expect(hasSearchClause).toBe(true);
    expect(hasLanguageClause).toBe(true);
  });

  it("where: narrowed price range adds one AND entry", () => {
    const where = buildDiscoverWhere(baseQuery({ minPrice: 100, maxPrice: 500 })) as any;
    expect(Array.isArray(where.AND)).toBe(true);
    expect(where.AND.length).toBe(1);
    const priceClause = where.AND[0];
    expect(JSON.stringify(priceClause)).toContain('"gte":100');
    expect(JSON.stringify(priceClause)).toContain('"lte":500');
  });

  it("where: minPrice>0 excludes the no-rate fallback branch", () => {
    const where = buildDiscoverWhere(baseQuery({ minPrice: 100, maxPrice: 500 })) as any;
    const priceOr = where.AND[0].OR;
    expect(priceOr.length).toBe(1);
  });

  it("where: minPrice=0 includes the no-rate fallback branch", () => {
    const where = buildDiscoverWhere(baseQuery({ minPrice: 0, maxPrice: 500 })) as any;
    const priceOr = where.AND[0].OR;
    expect(priceOr.length).toBe(2);
  });

  it("where: language filter matches both the name and the ISO code", () => {
    // Onboarding stores ISO codes ("en") while the filter UI sends names.
    const clauses = JSON.stringify((buildDiscoverWhere(baseQuery({ language: "English" })) as any).AND);
    expect(clauses).toContain('"en"');
    expect(clauses).toContain('"English"');
  });

  it("where: 'Chinese' resolves to Mandarin Chinese's code", () => {
    const where = buildDiscoverWhere(baseQuery({ language: "Chinese" })) as any;
    expect(JSON.stringify(where.AND)).toContain('"zh"');
  });

  it("where: gender match is case-insensitive", () => {
    // Stored as "male" or "Male"; the UI sends "MALE".
    const where = buildDiscoverWhere(baseQuery({ gender: "MALE" })) as any;
    expect(where.gender).toEqual({ equals: "MALE", mode: "insensitive" });
  });

  it("paginate: fewer results than limit -> no more pages", () => {
    const fetched = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
    const page = paginate(fetched, 5);
    expect(page.items.length).toBe(3);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it("paginate: handles paging and cursor calculation", () => {
    const fetched = [{ userId: "a" }, { userId: "b" }, { userId: "c" }];
    const page = paginate(fetched, 2);
    expect(page.items.length).toBe(2);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe("b");
  });

  it("paginate: empty result set handled", () => {
    const page = paginate([], 20);
    expect(page.items.length).toBe(0);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });
});

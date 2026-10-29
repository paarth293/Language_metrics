import { beforeEach, describe, expect, it } from "vitest";
import {
  __resetCacheForTests,
  clearCache,
  fetchResource,
  getEntry,
  invalidateResource,
  setCacheOwner,
} from "./resource-cache";

/**
 * The data cache is shared process-wide within a tab, so these cover the
 * boundaries that keep that safe: one signed-in identity at a time, no
 * carry-over across a role change, and a mutation invalidating only the
 * prefix it owns.
 */

beforeEach(__resetCacheForTests);

describe("cache isolation across sessions and roles", () => {
  it("drops a teacher's data when a student signs in on the same tab", async () => {
    setCacheOwner("teacher-1");
    await fetchResource("/api/teachers/earnings", async () => ({ paise: 450000 }));
    await fetchResource("/api/teachers/students", async () => ({ students: ["a", "b"] }));

    setCacheOwner("student-1");

    expect(getEntry("/api/teachers/earnings").data).toBeUndefined();
    expect(getEntry("/api/teachers/students").data).toBeUndefined();
  });

  it("drops a student's data when a teacher signs in on the same tab", async () => {
    setCacheOwner("student-1");
    await fetchResource("/api/students/wallet", async () => ({ balance: 1200 }));

    setCacheOwner("teacher-1");

    expect(getEntry("/api/students/wallet").data).toBeUndefined();
  });

  it("keeps sticky UI state out of the same namespace as request keys", async () => {
    await fetchResource("/api/students/classes?filter=past", async () => ({ bookings: [] }));
    // useStickyState writes under "ui-state:", so invalidating an API prefix
    // cannot clear a filter and a filter cannot shadow a request.
    invalidateResource("ui-state:");
    expect(getEntry("/api/students/classes?filter=past").updatedAt).toBeGreaterThan(0);
  });

  it("invalidates only the prefix a mutation owns", async () => {
    await fetchResource("/api/students/wallet", async () => ({ balance: 1200 }));
    await fetchResource("/api/teachers/wallet", async () => ({ balance: 9900 }));

    invalidateResource("/api/students/");

    // Stale, so it will revalidate — but still on screen, not discarded.
    expect(getEntry("/api/students/wallet").updatedAt).toBe(0);
    expect(getEntry<{ balance: number }>("/api/students/wallet").data).toEqual({ balance: 1200 });
    // The other role's key is untouched.
    expect(getEntry("/api/teachers/wallet").updatedAt).toBeGreaterThan(0);
  });

  it("a logout wipe is not undone by a response already in flight", async () => {
    setCacheOwner("student-1");
    let release: (value: unknown) => void = () => {};
    const pending = fetchResource("/api/students/wallet", () => new Promise((r) => { release = r; }));

    // The user signs out while the balance request is still open.
    setCacheOwner(null);
    clearCache();
    release({ balance: 1200 });
    await pending;

    expect(getEntry("/api/students/wallet").data).toBeUndefined();
  });

  it("keeps a response that was requested before the session resolved", async () => {
    // A hard load: the page asks for its data while /api/auth/me is still open.
    let release: (value: unknown) => void = () => {};
    const pending = fetchResource("/api/students/dashboard", () => new Promise((r) => { release = r; }));

    setCacheOwner("student-1"); // hydration, not an account switch
    release({ coinBalance: 1240 });
    await pending;

    expect(getEntry("/api/students/dashboard").data).toEqual({ coinBalance: 1240 });
    expect(getEntry("/api/students/dashboard").promise).toBeUndefined();
  });

  it("a signed-out tab that signs back in as the same user starts clean", async () => {
    setCacheOwner("student-1");
    await fetchResource("/api/students/wallet", async () => ({ balance: 1200 }));
    setCacheOwner(null);
    setCacheOwner("student-1");
    expect(getEntry("/api/students/wallet").data).toBeUndefined();
  });
});

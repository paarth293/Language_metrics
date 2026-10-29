import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetCacheForTests,
  clearCache,
  fetchResource,
  getCacheOwner,
  getEntry,
  invalidateResource,
  mutateResource,
  setCacheOwner,
  subscribe,
} from "./resource-cache";

beforeEach(__resetCacheForTests);

describe("resource-cache", () => {
  it("stores a success and reports when it landed", async () => {
    await fetchResource("/api/a", async () => ({ n: 1 }));
    const entry = getEntry<{ n: number }>("/api/a");
    expect(entry.data).toEqual({ n: 1 });
    expect(entry.error).toBeUndefined();
    expect(entry.updatedAt).toBeGreaterThan(0);
    expect(entry.failedAt).toBe(0);
  });

  it("de-duplicates concurrent requests for the same key", async () => {
    const fetcher = vi.fn(async () => "value");
    await Promise.all([
      fetchResource("/api/a", fetcher),
      fetchResource("/api/a", fetcher),
      fetchResource("/api/a", fetcher),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous payload visible when a refresh fails", async () => {
    await fetchResource("/api/a", async () => "first");
    await fetchResource("/api/a", async () => {
      throw new Error("offline");
    });
    const entry = getEntry<string>("/api/a");
    expect(entry.data).toBe("first");
    expect((entry.error as Error).message).toBe("offline");
    expect(entry.failedAt).toBeGreaterThan(0);
  });

  it("notifies subscribers of the key that changed, and only that key", async () => {
    const onA = vi.fn();
    const onB = vi.fn();
    subscribe("/api/a", onA);
    subscribe("/api/b", onB);
    await fetchResource("/api/a", async () => 1);
    expect(onA).toHaveBeenCalled();
    expect(onB).not.toHaveBeenCalled();
  });

  it("stops notifying after unsubscribe", async () => {
    const cb = vi.fn();
    subscribe("/api/a", cb)();
    await fetchResource("/api/a", async () => 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it("invalidate marks a prefix stale but keeps the data on screen", async () => {
    await fetchResource("/api/teachers/dashboard", async () => "dash");
    await fetchResource("/api/students/me", async () => "me");
    invalidateResource("/api/teachers/");
    expect(getEntry("/api/teachers/dashboard").data).toBe("dash");
    expect(getEntry("/api/teachers/dashboard").updatedAt).toBe(0);
    expect(getEntry("/api/students/me").updatedAt).toBeGreaterThan(0);
  });

  it("mutate writes a payload without a request", () => {
    mutateResource("/api/a", { n: 2 });
    expect(getEntry<{ n: number }>("/api/a").data).toEqual({ n: 2 });
  });

  it("clearCache discards protected data and wakes subscribers", async () => {
    const cb = vi.fn();
    await fetchResource("/api/a", async () => "secret");
    subscribe("/api/a", cb);
    clearCache();
    expect(getEntry("/api/a").data).toBeUndefined();
    expect(cb).toHaveBeenCalled();
  });

  it("first owner resolution hydrates without wiping", async () => {
    await fetchResource("/api/a", async () => "kept");
    expect(getCacheOwner()).toBeUndefined();
    setCacheOwner("user-1");
    expect(getEntry("/api/a").data).toBe("kept");
  });

  it("changing owner wipes the cache so the next account sees nothing", async () => {
    setCacheOwner("user-1");
    await fetchResource("/api/a", async () => "user-1 data");
    setCacheOwner("user-2");
    expect(getEntry("/api/a").data).toBeUndefined();
  });

  it("logging out wipes the cache", async () => {
    setCacheOwner("user-1");
    await fetchResource("/api/a", async () => "user-1 data");
    setCacheOwner(null);
    expect(getEntry("/api/a").data).toBeUndefined();
  });

  it("discards a response that arrives after the user changed", async () => {
    setCacheOwner("user-1");
    let release: (value: string) => void = () => {};
    const pending = fetchResource("/api/a", () => new Promise<string>((r) => { release = r; }));
    setCacheOwner("user-2");
    release("user-1 data");
    await pending;
    expect(getEntry("/api/a").data).toBeUndefined();
  });

  it("re-setting the same owner is a no-op", async () => {
    setCacheOwner("user-1");
    await fetchResource("/api/a", async () => "kept");
    setCacheOwner("user-1");
    expect(getEntry("/api/a").data).toBe("kept");
  });
});

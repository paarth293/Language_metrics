import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

// #39: the in-process limiter must not grow without bound. Once its Map holds
// more than 1,000 keys, a write clears every expired entry.
let rateLimit: typeof import("./rate-limit").rateLimit;
let inProcessStoreSize: typeof import("./rate-limit").inProcessStoreSize;

beforeEach(async () => {
  vi.useFakeTimers();
  vi.resetModules(); // empty Map for each test
  ({ rateLimit, inProcessStoreSize } = await import("./rate-limit"));
});

afterEach(() => {
  vi.useRealTimers();
});

const fill = (count: number, windowMs: number) => {
  for (let i = 0; i < count; i++) rateLimit(`key-${i}`, { windowMs, max: 10 });
};

describe("rateLimit in-process store pruning (#39)", () => {
  it("clears expired entries on the first write after it passes 1,000 keys", () => {
    fill(1001, 1_000);
    expect(inProcessStoreSize()).toBe(1001);

    vi.advanceTimersByTime(2_000); // every window has expired
    rateLimit("new-key", { windowMs: 1_000, max: 10 });

    expect(inProcessStoreSize()).toBe(1);
  });

  it("keeps entries whose window is still open", () => {
    fill(1001, 60_000);
    vi.advanceTimersByTime(2_000);
    rateLimit("new-key", { windowMs: 60_000, max: 10 });

    expect(inProcessStoreSize()).toBe(1002);
  });

  it("does not prune at 1,000 keys or fewer", () => {
    fill(1000, 1_000);
    vi.advanceTimersByTime(2_000);
    rateLimit("new-key", { windowMs: 1_000, max: 10 });

    expect(inProcessStoreSize()).toBe(1001);
  });

  it("still enforces limits for keys that survive pruning", () => {
    fill(1001, 1_000);
    const opts = { windowMs: 60_000, max: 2 };
    expect(rateLimit("user", opts)).toBe(false);
    vi.advanceTimersByTime(2_000);
    expect(rateLimit("user", opts)).toBe(false);
    expect(rateLimit("user", opts)).toBe(true); // 3rd call with max 2
  });
});

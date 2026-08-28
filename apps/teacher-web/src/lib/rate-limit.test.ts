import { describe, it, expect, vi, beforeEach } from "vitest";
import { rateLimit, exceedsMaxBodySize } from "./rate-limit";

describe("rateLimit (in-process)", () => {
  beforeEach(() => {
    // Reset the internal store by advancing time past all windows
    vi.useFakeTimers();
  });

  it("should allow requests under the limit", () => {
    const id = `test-${Date.now()}-allow`;
    const result = rateLimit(id, { windowMs: 60_000, max: 3 });
    expect(result).toBe(false);
  });

  it("should block requests that exceed the limit", () => {
    const id = `test-${Date.now()}-block`;
    const opts = { windowMs: 60_000, max: 3 };

    expect(rateLimit(id, opts)).toBe(false); // 1
    expect(rateLimit(id, opts)).toBe(false); // 2
    expect(rateLimit(id, opts)).toBe(false); // 3
    expect(rateLimit(id, opts)).toBe(true);  // 4 → blocked
    expect(rateLimit(id, opts)).toBe(true);  // 5 → still blocked
  });

  it("should reset after the window expires", () => {
    const id = `test-${Date.now()}-reset`;
    const opts = { windowMs: 1000, max: 2 };

    expect(rateLimit(id, opts)).toBe(false); // 1
    expect(rateLimit(id, opts)).toBe(false); // 2
    expect(rateLimit(id, opts)).toBe(true);  // 3 → blocked

    // Advance past the window
    vi.advanceTimersByTime(1100);

    expect(rateLimit(id, opts)).toBe(false); // 1 in new window
  });

  it("should track different identifiers independently", () => {
    const id1 = `test-${Date.now()}-a`;
    const id2 = `test-${Date.now()}-b`;
    const opts = { windowMs: 60_000, max: 1 };

    expect(rateLimit(id1, opts)).toBe(false); // id1: 1
    expect(rateLimit(id1, opts)).toBe(true);  // id1: 2 → blocked

    // id2 should still be allowed
    expect(rateLimit(id2, opts)).toBe(false); // id2: 1
  });

  it("should use default options when none provided", () => {
    const id = `test-${Date.now()}-defaults`;
    // Default: windowMs=60000, max=10
    for (let i = 0; i < 10; i++) {
      expect(rateLimit(id)).toBe(false);
    }
    expect(rateLimit(id)).toBe(true); // 11th → blocked
  });

  afterEach(() => {
    vi.useRealTimers();
  });
});

describe("exceedsMaxBodySize", () => {
  function makeRequest(contentLength: string | null): Request {
    const headers = new Headers();
    if (contentLength !== null) {
      headers.set("content-length", contentLength);
    }
    return new Request("http://localhost/test", { headers });
  }

  it("should return false when Content-Length is missing", () => {
    const req = makeRequest(null);
    expect(exceedsMaxBodySize(req)).toBe(false);
  });

  it("should return false when Content-Length is within default limit (16KB)", () => {
    const req = makeRequest("1000"); // 1KB
    expect(exceedsMaxBodySize(req)).toBe(false);
  });

  it("should return false when Content-Length equals the limit", () => {
    const req = makeRequest("16384"); // exactly 16KB
    expect(exceedsMaxBodySize(req)).toBe(false);
  });

  it("should return true when Content-Length exceeds default limit", () => {
    const req = makeRequest("16385"); // 16KB + 1 byte
    expect(exceedsMaxBodySize(req)).toBe(true);
  });

  it("should respect custom maxBytes parameter", () => {
    const req = makeRequest("2000");
    expect(exceedsMaxBodySize(req, 1000)).toBe(true);
    expect(exceedsMaxBodySize(req, 3000)).toBe(false);
  });

  it("should return true for very large payloads", () => {
    const req = makeRequest("10000000"); // 10MB
    expect(exceedsMaxBodySize(req)).toBe(true);
  });
});

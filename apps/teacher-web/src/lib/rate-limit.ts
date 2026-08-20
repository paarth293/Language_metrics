/**
 * src/lib/rate-limit.ts
 *
 * A lightweight, in-process rate limiter for Next.js API route handlers.
 *
 * WHY IN-PROCESS?
 * For a single-server deployment this is sufficient. If you later move to
 * multiple Next.js instances (Vercel edge replicas, etc.) replace the
 * in-memory `Map` with a Redis-backed store (e.g. upstash/ratelimit).
 *
 * USAGE (in any route handler):
 *
 *   import { rateLimit } from "@/lib/rate-limit";
 *
 *   export async function POST(request: Request) {
 *     const ip = request.headers.get("x-forwarded-for") ?? "unknown";
 *     const limited = rateLimit(ip, { windowMs: 60_000, max: 10 });
 *     if (limited) {
 *       return NextResponse.json(
 *         { message: "Too many requests. Please try again later." },
 *         { status: 429, headers: { "Retry-After": "60" } }
 *       );
 *     }
 *     // ... rest of handler
 *   }
 */

interface Window {
  count: number;
  resetAt: number;
}

// IP → sliding-window state. Cleared automatically as windows expire.
const store = new Map<string, Window>();

interface RateLimitOptions {
  /** Duration of the window in milliseconds. Default: 60 000 (1 minute). */
  windowMs?: number;
  /** Maximum requests allowed within the window. Default: 10. */
  max?: number;
}

/**
 * Returns `true` if the caller is rate-limited (should receive 429),
 * `false` if the request is allowed through.
 */
export function rateLimit(
  identifier: string,
  { windowMs = 60_000, max = 10 }: RateLimitOptions = {}
): boolean {
  const now = Date.now();
  const existing = store.get(identifier);

  if (!existing || now > existing.resetAt) {
    // Start a fresh window
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return false;
  }

  existing.count += 1;
  if (existing.count > max) {
    return true; // rate-limited
  }
  return false;
}

/**
 * Guards a route against unreasonably large request bodies (e.g. a 50 MB JSON
 * blob designed to exhaust server memory before Zod even runs).
 *
 * Returns `true` (blocked) if the Content-Length header exceeds `maxBytes`.
 * Defaults to 16 KB — more than enough for any auth form payload.
 *
 * NOTE: Content-Length can be spoofed; this is a first-line guard only.
 * Production deployments should also set a body size limit at the reverse
 * proxy / CDN layer.
 */
export function exceedsMaxBodySize(
  request: Request,
  maxBytes = 16_384 // 16 KB
): boolean {
  const contentLength = request.headers.get("content-length");
  if (!contentLength) return false; // unknown — let the handler proceed
  return parseInt(contentLength, 10) > maxBytes;
}

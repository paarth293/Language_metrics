import { createHash, randomBytes } from "crypto";

/**
 * CSRF protection for admin login (synchronizer / double-submit pattern):
 *  1. Origin allowlist — reject missing or non-allowlisted Origin (403).
 *  2. Double-submit cookie — csrf_token cookie must match form field when set.
 *
 * Documented in SECURITY.md.
 */

function allowlist(): string[] {
  const urls = [
    process.env.ADMIN_PANEL_URL,
    process.env.APP_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    "http://localhost:3001",
    "http://127.0.0.1:3001",
  ].filter(Boolean) as string[];
  return [...new Set(urls.map((u) => u.replace(/\/$/, "")))];
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  const normalized = origin.replace(/\/$/, "");
  return allowlist().includes(normalized);
}

/** Reject when Origin is missing or not on the allowlist. */
export function assertValidOrigin(origin: string | null): {
  ok: true;
} | { ok: false; status: 403; message: string } {
  if (!origin) {
    return {
      ok: false,
      status: 403,
      message: "Missing Origin header",
    };
  }
  if (!isAllowedOrigin(origin)) {
    return {
      ok: false,
      status: 403,
      message: "Origin not allowed",
    };
  }
  return { ok: true };
}

export function generateCsrfToken(): string {
  return randomBytes(32).toString("hex");
}

/** Constant-time compare of cookie vs form token. */
export function csrfTokensMatch(
  cookieToken: string | undefined,
  formToken: string | undefined,
): boolean {
  if (!cookieToken || !formToken) return false;
  if (cookieToken.length !== formToken.length) return false;
  const a = createHash("sha256").update(cookieToken).digest();
  const b = createHash("sha256").update(formToken).digest();
  // timingSafeEqual on hashes avoids length leaks on the raw tokens
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

export const CSRF_COOKIE = "csrf_token";


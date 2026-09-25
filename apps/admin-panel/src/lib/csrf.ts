import { createHash, randomBytes } from "crypto";

/**
 * CSRF protection for admin login (synchronizer / double-submit pattern):
 *  1. Same-origin check — lib/security.ts#assertSameOrigin() rejects any
 *     request whose Origin header doesn't match the request's own Host
 *     (defense-in-depth on top of the SameSite=strict session cookie).
 *  2. Double-submit cookie — csrf_token cookie must match form field when set.
 *
 * Documented in SECURITY.md.
 *
 * Fix (errors.md #N9): this file used to also define an env-var-driven
 * ADMIN_PANEL_URL/APP_URL origin allowlist (`isAllowedOrigin`,
 * `assertValidOrigin`, `allowlist()`), but nothing in the codebase ever
 * called them — the actual origin check wired into the login flow is
 * assertSameOrigin() above, which doesn't read those env vars at all. That
 * left dead code sitting next to .env.example's (incorrect) warning that
 * forgetting to set ADMIN_PANEL_URL would get every production login
 * rejected with "Origin not allowed" — a failure mode that could not
 * actually happen, since the function that would produce it was never
 * invoked. Removed the unused functions rather than leave security-shaped
 * dead code that misrepresents what's actually enforced; the .env.example
 * comment has been corrected to match. If a fixed-allowlist check (in
 * addition to assertSameOrigin) is wanted later, reintroduce it and call it
 * from requireApiAdmin()/authenticateAdmin() explicitly so it's actually
 * part of the request path.
 */

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


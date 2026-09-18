/**
 * Runtime configuration for the student mobile app.
 *
 * Values come from `EXPO_PUBLIC_*` variables (inlined by Metro at bundle time):
 *   - local dev: `apps/student-mobile/.env` (see `.env.example`)
 *   - EAS builds: the `env` block of the matching profile in `eas.json`
 * Defaults point at production so a build without env vars still works.
 */

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

/** Versioned mobile API served by apps/student-web (`/api/v1/*`). */
export const API_BASE_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_API_URL || "https://language-metrics-student-web.vercel.app/api/v1"
);

/** Student web portal (wallet top-ups, live classroom, help pages). */
export const STUDENT_WEB_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_STUDENT_WEB_URL || "https://language-metrics-student-web.vercel.app"
);

/** Public site (student registration, password reset). */
export const PUBLIC_SITE_URL = stripTrailingSlash(
  process.env.EXPO_PUBLIC_PUBLIC_SITE_URL || "https://language-metrics-teacher-web.vercel.app"
);

export const APP_VERSION = "1.0.0";

/** Network timeout for every API call. */
export const REQUEST_TIMEOUT_MS = 20_000;

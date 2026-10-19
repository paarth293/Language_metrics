// Shared k6 helpers. Run only against local or staging — see ../README.md.
import http from "k6/http";
import { fail } from "k6";

export const BASE_URL = (__ENV.BASE_URL || "http://localhost:3002").replace(/\/+$/, "");

// Hard refusal to touch production. Extend if production gets a custom domain.
const FORBIDDEN_HOSTS = [
  "language-metrics-student-web.vercel.app",
  "language-metrics-teacher-web.vercel.app",
  "language-metrics-admin-panel.vercel.app",
  "languagemetrics.in",
];
const host = BASE_URL.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
if (FORBIDDEN_HOSTS.some((h) => host === h || host.endsWith("." + h))) {
  fail(`Refusing to load-test production host ${host}. Use local or staging.`);
}
if (__ENV.I_CONFIRM_NOT_PRODUCTION !== "yes") {
  fail("Set I_CONFIRM_NOT_PRODUCTION=yes to confirm BASE_URL is local or staging.");
}

// ramp-up -> steady -> spike -> recover. Scale with TARGET_VUS.
const T = Number(__ENV.TARGET_VUS || 200);
export const standardStages = [
  { duration: "2m", target: Math.round(T * 0.5) }, // ramp-up
  { duration: "3m", target: T },                   // ramp to steady
  { duration: "10m", target: T },                  // steady
  { duration: "30s", target: T * 5 },              // spike (e.g. classes starting on the hour)
  { duration: "2m", target: T * 5 },               // hold spike
  { duration: "1m", target: T },                   // recover
  { duration: "1m", target: 0 },                   // ramp-down
];

export const ACCESS_COOKIE = "lm_student_access_token";

// Test accounts: STUDENT_EMAILS="a@x.test,b@x.test" with one shared STUDENT_PASSWORD.
// Seed these on staging; never use real users' accounts.
export const STUDENT_EMAILS = (__ENV.STUDENT_EMAILS || "").split(",").map((s) => s.trim()).filter(Boolean);
export const STUDENT_PASSWORD = __ENV.STUDENT_PASSWORD || "";

export function pickEmail() {
  if (STUDENT_EMAILS.length === 0) fail("Set STUDENT_EMAILS (comma-separated test accounts).");
  return STUDENT_EMAILS[(__VU - 1) % STUDENT_EMAILS.length];
}

/**
 * Log in once per VU and return the access-token cookie value.
 * Note: login is rate-limited to 10/min per IP (apps/student-web/src/app/api/auth/login/route.ts:22),
 * so from a single load generator only the first logins succeed. Either run setup-time
 * logins (as the scripts here do) or whitelist the generator IP on staging.
 */
export function login(email) {
  const res = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email, password: STUDENT_PASSWORD, role: "STUDENT" }),
    { headers: { "Content-Type": "application/json" }, tags: { name: "login" } }
  );
  const c = res.cookies[ACCESS_COOKIE];
  return c && c.length ? c[0].value : null;
}

/** Log in every test account in setup() so the per-IP login limit is hit once, not per iteration. */
export function loginAll() {
  const tokens = {};
  for (const email of STUDENT_EMAILS) {
    const t = login(email);
    if (t) tokens[email] = t;
  }
  if (Object.keys(tokens).length === 0) fail("No test account could log in. Check credentials / rate limit.");
  return tokens;
}

export function authParams(token, name) {
  return {
    headers: { "Content-Type": "application/json", Cookie: `${ACCESS_COOKIE}=${token}` },
    tags: { name },
  };
}

export function tokenFor(tokens) {
  const emails = Object.keys(tokens);
  return tokens[emails[(__VU - 1) % emails.length]];
}

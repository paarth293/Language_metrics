# Teacher-Web Portal — Error & Issue Analysis, and Fixes

**Scope:** `apps/teacher-web/` (teacher, student, and mini-admin experiences), cross-checked against `packages/database/prisma/schema.prisma`.
**Status:** this started as a read-only pass (nothing changed). It has since been followed up with an actual fix pass — everything below is marked Fixed, Corrected, or Left as documented risk. The full narrative version of this (with more detail on the one correction and one bug found while fixing) lives in the repo root's `errors.md`, under "Language Metrics — Teacher-Web Portal: Error Log, Fixes, and Impact Analysis."
**Verification note:** this sandbox's outbound network cannot reach the npm registry, so `npm install` / `next build` / `tsc --noEmit` / `eslint` / `vitest` could not be run here, before or after the fixes. Every fix was written and re-read by hand and spot-checked with a standalone TypeScript compiler where possible. Run your own `npm run lint && npx tsc --noEmit && npm run build && npm test` in `apps/teacher-web` before deploying.

---

## Critical / High

### 1. [FIXED] CSRF protection and general API rate-limiting in `proxy.ts` were dead code
`proxy.ts`'s CSRF/rate-limit checks were gated on `/api/` paths that both `config.matcher` and the function's own `EXCLUDED_PREFIXES` excluded from ever reaching `proxy()`. Removed `api/` from both exclusions so the checks now run; `/api/*` routes still handle their own auth via `requireAuth()` since `isProtected()` doesn't match API paths.

### 2. [FIXED] The origin check was bypassable
`!origin.includes(host)` accepted any origin containing `host` as a substring. Now parses `Origin` with `new URL(origin).host` and compares exactly.

### 3. [CORRECTED] Google OAuth callback `userRole === "ADMIN"` — not actually a compile error
Originally reported as a hard `TS2367` TypeScript error. On mechanical re-verification, it isn't: the comparison sits in a third `else if`, after branches that already excluded `"STUDENT"` and `"TEACHER"`, so TypeScript narrows `userRole` to `never` there — and `never`-vs-literal comparisons are the standard exhaustiveness-check idiom TypeScript allows without error. The real (lower-severity) issue was that `userRole`'s declared type (`"STUDENT" | "TEACHER"`) didn't include `"ADMIN"` even though an existing admin account can reach this code path via account linking, so the type was quietly hiding a case the code correctly handles at runtime. Fixed by widening `userRole` to the shared `Role` type (`"STUDENT" | "TEACHER" | "ADMIN"`).

### 4. [FIXED] Password reset didn't revoke existing sessions
Added `await revokeAllRefreshSessions(user.id)` after the password hash is updated, so refresh tokens issued before the reset no longer outlive it.

---

## Medium

### 5. [FIXED] Verification-status UI was broken by an enum case mismatch
`types/index.ts`'s `VerificationStatus` is now `"PENDING" | "INTERVIEW_SCHEDULED" | "APPROVED" | "REJECTED"`, matching Prisma exactly. `StatusBadge`, `AdminDashboard` (filters, default filter, Approve/Reject checks, and a new stat card), `lib/api.ts`'s `adminApi` signatures, and `api/admin/teachers/route.ts`'s status allow-list were all updated to match. **Bonus find while fixing this:** `AdminDashboard`'s `Summary` interface read lowercase keys (`summary.pending` etc.) but the API returns uppercase keys (`summary.PENDING` etc.) — three of the four stat cards were silently showing `undefined`. Fixed alongside.

### 6. [FIXED] No role/auth guard on the teacher and student page shells
`AppShell` now takes a `requiredRole` prop and redirects unauthenticated visitors to `/login` and wrong-role visitors to their own dashboard, mirroring the pattern already used in `admin/dashboard/page.tsx`. `teacher/layout.tsx` and `student/layout.tsx` now pass `requiredRole="TEACHER"` / `"STUDENT"`.

### 7. [FIXED] Wrong dev port for the admin redirect
`localhost:3001` (student-web's port) → `localhost:3003` (admin-panel's port), in both `lib/auth-client.tsx` and the OAuth callback.

### 8. [FIXED] External redirect used the wrong API
`router.replace(...)` → `window.location.href = ...` for the cross-origin admin-panel redirect in `lib/auth-client.tsx`.

### 9. [FIXED] `/api/auth/verify-otp` could never succeed
Rewrote it to check the `EmailVerificationCode` table (matching the working `verify-email` handler) instead of the link-token field it was previously comparing against. Still not linked from any page — but now actually does what it claims to.

### 10. [FIXED] `/admin` was missing from the proxy's protected-route list
Added `/admin` to `PROTECTED_PREFIXES`; removed the dead `/dashboard` entry.

### 11. [FIXED] Dead conditional in `getStorageInfo()`
`configured: PROVIDER !== "local" || true` (always `true`) → now checks the actual provider-specific credential env vars.

### 12. [FIXED] Dead nav link: "Live Class" 404'd
Removed the "Live Class" sidebar item (no page exists at the bare `/student/live` path; sessions are reached via a specific `[sessionId]`).

---

## Low / Code hygiene

### 13. [FIXED] `lib/api.ts`'s dead localStorage/Bearer-token interceptor
Removed; added `withCredentials: true` so the cookie-based auth already used everywhere else works through this client too.

### 14. [LEFT AS DOCUMENTED RISK] Three parallel email-verification mechanisms
`EmailVerificationCode` table, `User.emailVerificationToken` link-token fields, and Redis `reg-otp:*` keys. Each is now correctly matched to the routes that use it (fixing #9 resolved the one place they were crossed), but consolidating into one mechanism is an architecture decision bigger than this fix pass — left as documented risk.

### 15. [FIXED] Leftover "thinking out loud" comments
Replaced the multi-line internal-monologue comment in `forgot-password/verify-otp/route.ts` with one factual comment.

### 16. [LEFT AS ACCEPTED TRADE-OFF] Soft rate limit on `/api/auth/upload`
Anonymous uploads during registration, 10 req/min/IP only, no daily cap. Reasonable for its purpose; noted, not changed.

### 17. [LEFT AS DOCUMENTED RISK] Duplicated verification-queue feature across teacher-web and admin-panel
Type consistency between the two is now fixed (#5), but the duplicated UI/API implementation itself is a larger consolidation than this pass's scope.

---

## What was checked and found to already be correct
- Every route under `/api/students/*`, `/api/teachers/*`, `/api/admin/*` correctly gates on role via `requireAuth`.
- `lib/auth.test.ts`, `lib/otp.ts`, `lib/sanitize.ts` match their tests/docstrings.
- `teacher-service.ts`'s `TeacherRate.teacherId_type` compound key matches `schema.prisma`.

# Language Metrics — Sprint Baseline Verification

**Date:** September 7, 2026  
**Branch:** `milestone/2-booking-system-2026-09-07`  
**Prepared For:** Milestone 1 & 2 Completion Sprint  

---

## 1. Summary Baseline Scorecard

| Category | Metric | Baseline Status | Notes |
| :--- | :--- | :--- | :--- |
| **TypeScript Compilation** | `npx tsc --noEmit` across all apps | **0 errors** | Strict mode passing across all apps |
| **Monorepo Linting** | `npm run lint --workspaces --if-present` | **0 errors** | `admin-panel`, `student-web`, `teacher-web` clean |
| **Unit Test Execution** | `vitest run` across workspaces | **189 passed / 0 failed** | 14 test suites passing (100%) |
| **Security Suite** | `python security-tests/run_all.py` | **0 failures (`[OK]`)** | All 6 security test modules active |
| **Dependency Vulnerabilities** | `npm audit` | **0 high / 0 critical** | Only 3 moderate in transitive `@smithy` packages |
| **Secret Leaks** | `git log --all --oneline -- .env` | **0 commits found** | `.env` never committed; `.gitignore` rules active |
| **Monorepo Build** | `npm run build` | **Exited 0** | Turbopack builds & static generation successful |

---

## 2. Workspace Test Suite Breakdown

### `apps/admin-panel`
- **Runner**: Vitest v4.1.11
- **Status**: 4 test files passed, 18 tests passed (0 failures)
  - `src/lib/totp.test.ts` (6 tests)
  - `src/lib/ratelimit.test.ts` (6 tests)
  - `src/lib/auth.test.ts` (6 tests)

### `apps/student-web`
- **Runner**: Vitest v4.1.11
- **Status**: 5 test files passed, 79 tests passed (0 failures)
  - `src/lib/sanitize.test.ts` (25 tests)
  - `src/lib/discover-query.test.ts` (13 tests)
  - `src/lib/validation.test.ts` (27 tests)
  - `src/lib/livekit.test.ts` (8 tests)
  - `src/lib/storage.test.ts` (6 tests)

### `apps/teacher-web`
- **Runner**: Vitest v4.1.11
- **Status**: 5 test files passed, 92 tests passed (0 failures)
  - `src/features/auth/validators/auth.test.ts` (20 tests)
  - `src/lib/auth.test.ts` (25 tests)
  - `src/lib/otp.test.ts` (15 tests)
  - `src/lib/rate-limit.test.ts` (14 tests)
  - `src/lib/sanitize.test.ts` (18 tests)

---

## 3. Pre-Sprint Status of Security Fixes (Issues #1–#7, #11, #13–#18)

- **Fix #1 (CSRF Protection)**: Edge proxy Origin check active on all state-mutating `/api/*` routes.
- **Fix #2 (Origin Check)**: Exact `new URL(origin).host === host` validation enforced.
- **Fix #3 (Google OAuth)**: Type union corrected to include all Prisma roles; administrative login requires TOTP.
- **Fix #4 (Password Reset Session Revocation)**: `revokeAllRefreshSessions` called on password reset.
- **Fix #5 (Admin Session Revocation on Role/Status Change)**: Targeted for implementation in Part 1.
- **Fix #6 (Page Shell Role Guards)**: `AppShell.tsx` guards `student/layout.tsx` and `teacher/layout.tsx`.
- **Fix #7 (`/admin` Protected)**: `/admin` included in `PROTECTED_PREFIXES`.
- **Fix #11 (VerificationStatus Enum)**: Aligned to uppercase Prisma enum across UI and API.
- **Fix #13 (Verify OTP Endpoint)**: Rewritten to read from `EmailVerificationCode` store.
- **Fix #14 & #15 (Admin Port & External Redirect)**: Admin URL uses port 3003 and `window.location.href`.
- **Fix #16 (Storage Config Check)**: Cleaned up redundant conditional.
- **Fix #17 (Test Artifacts)**: `cookie.txt` and `login_response.json` removed and permanently ignored.
- **Fix #18 (Leftover Comments)**: Scratch commentary removed from auth routes.

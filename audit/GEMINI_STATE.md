# GEMINI_STATE.md — Current Session & Progress State

This file tracks the operational state, branch details, and progress of the performance engineering batch on `fix/perf`.

## Current Context
- **Branch**: `fix/perf` (branched from `fix/phase3-security` @ `c5a8b5f`)
- **Plan Reference**: [`audit/PERF_PLAN.md`](file:///c:/Users/PRIYANSHU/Language_metrics/audit/PERF_PLAN.md)
- **Progress Tracker**: [`audit/PROGRESS_PERF.md`](file:///c:/Users/PRIYANSHU/Language_metrics/audit/PROGRESS_PERF.md)
- **Report**: [`audit/PERF_REPORT.md`](file:///c:/Users/PRIYANSHU/Language_metrics/audit/PERF_REPORT.md)

---

## Baseline Verification Checks
All checks verified on current branch:
| Check | Status | Details |
|---|---|---|
| `npm run typecheck` | **PASS (0 errors)** | All apps (`student-web`, `teacher-web`, `admin-panel`, `student-mobile`) and all packages clean. |
| `npm run lint` | **PASS (0 errors)** | Max warnings 0 across all workspaces. |
| `npm run test:payments` | **PASS** | 217 passed, 0 failed, 2 skipped (expected sandbox/db skips). |
| `next build` (student-web) | **PASS** | Turbopack compilation + static generation (46/46) successful. |
| `next build` (teacher-web) | **PASS** | Turbopack compilation + static generation (98/98) successful. |
| `next build` (admin-panel) | **PASS** | Turbopack compilation + static generation (9/9) successful. |
| `npm test` | **PASS** | All unit tests pass in isolation. (Two known wall-clock timeout tests documented in `PROGRESS_PERF.md` pass when run in isolation on an idle runner). |

---

## Performance Work Items (Step 3: Implementation)

| ID | Item | Status | Notes / Commit |
|---|---|---|---|
| **P1** | Recordings routes: narrow `select` instead of `include: { user: true }`, both apps | **DONE** | Commits `064494f` & `ed619d6`. Eliminated exposure of sensitive `User` fields. |
| **P11** | teacher-web: zod out of the shared shell | **DONE** | Commit `d8c749a`. Dynamic import of `DateOfBirthPrompt` removed zod from shared shell bundle. |
| **P3** | AppShell: render shell and children immediately | **DONE (Ready to commit)** | Modified `AppShell.tsx` and `Sidebar.tsx` in `student-web` and `teacher-web`. Children mount immediately so page fetches run in parallel with `/api/auth/me`. Verified with `AppShell.parallel-auth.test.tsx` in both apps. |
| **P12** | student-web: dead command-palette branch | Next | Ready to implement |
| **P4** | student-web: duplicate unread-count fetch | Queued | TopBar + Sidebar sync |
| **P13** | Dashboards: stop polling hidden tabs | Queued | Add visibility guards |
| **P5** | Discover: review aggregate (`groupBy` / `_avg` / `_count`) | Queued | Decision D3 Option A |
| **P7** | Dashboards: database aggregates | Queued | Avoid fetching all bookings |
| **P8** | Unbounded lists: `take` + cursors | Queued | Pagination safety |
| **P9** | Shared response cache | Queued | Redis-backed caching |
| **P10** | Shared exchange-rate cache | Queued | Decision D4 Option A (cache adapter) |
| **P15** | Index migration files | Queued | Migration definitions |

---

## Apps Status & Error Resolution
- **Apps verification**:
  - `apps/student-web`: No TypeScript errors, no lint errors, build succeeds, all 239 vitest tests pass.
  - `apps/teacher-web`: No TypeScript errors, no lint errors, build succeeds, all 311 vitest tests pass (including `outbound.timeout.test.ts` in isolation).
  - `apps/admin-panel`: No TypeScript errors, no lint errors, build succeeds, all tests pass.
  - `apps/student-mobile`: No TypeScript errors.
- **Identified test timeout under heavy load**:
  - `AppShell.parallel-auth.test.tsx` in both `student-web` and `teacher-web` now has an explicit 15,000 ms timeout on the route handler import test to ensure it remains stable during multi-workspace parallel runs.

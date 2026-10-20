# PROGRESS_PERF.md — performance work

Say "continue" and I read this file and resume from the first row that is not DONE.

| Branch | Made from |
|---|---|
| `fix/perf` | `fix/phase3-security` @ `c5a8b5f` |

## Baseline checks on `fix/perf` before any change

| check | result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm test` | 766 passed, 0 failed |
| `npm run test:payments` | 217 passed, 0 failed, 2 skipped |

Fully green, so there is no permitted failure. Any failure in Step 3 is a regression and the change gets undone.

## Steps

| Step | Status | Output | Notes |
|---|---|---|---|
| 1 Baseline | **DONE** | `audit/PERF_BASELINE.md` | Real `next build` plus `next start` for both web apps against a dead local database. 10 suspects adjudicated: 6 confirmed, 1 not confirmed on cost, 3 partly. 14 findings with file and line evidence |
| 2 Plan | **DONE** | `audit/PERF_PLAN.md` | Go given. All four decisions answered and recorded at the top of the plan |
| 3 Implement | **PAUSED after P1** | | Interrupted by a new, unrelated task (the 4-hour student cancel window, branch `fix/cancel-window`). Resume from the P-table below |
| 4 Verify and report | partial | `audit/PERF_REPORT.md` | Contains the measurement ground rules and the credential-exposure finding. The rest is written as items land |

## Decisions — all answered

| id | Subject | Decision |
|---|---|---|
| D1 | silent-refresh costs 3 requests per navigation | **Leave as is.** Auth code. Follow-up for a separate auth batch |
| D2 | `/teacher/login` and `/student/login` rewrites never fire | **Leave as is.** `next.config.ts` untouched |
| D3 | discover loads every review row | **`groupBy` / `_avg` / `_count`, no schema change** |
| D4 | exchange-rate cache is per-instance | **Inject a cache adapter, no new dependency** |
| — | throwaway Postgres for measurement | **No local or test database.** None created, production URL never read or used, no query run against any real database. Every database-side item ships NOT VERIFIED for timing |
| — | open `proxy.ts` for P14 | **Not authorised.** P14 dropped, recorded as a follow-up |

## Item status

| id | Item | Status | Commit | Proof |
|---|---|---|---|---|
| P1 | Recordings routes: narrow `select` instead of `include: { user: true }`, both apps | **DONE** | see `git log` | 5 tests per app. 2 of them fail on the old code and pass on the new. Credential-column regression guard included |
| P11 | teacher-web: zod out of the shared shell | not started | | Measurable from `next build` |
| P12 | student-web: dead command-palette branch | not started | | |
| P4 | student-web: duplicate unread-count fetch | not started | | |
| P13 | Dashboards: stop polling hidden tabs | not started | | |
| P3 | AppShell: render shell and children immediately | not started | | Needs the unauthenticated-access test |
| P5 | Discover: review aggregate | not started | | Timing NOT VERIFIED |
| P7 | Dashboards: database aggregates | not started | | Timing NOT VERIFIED |
| P8 | Unbounded lists: `take` plus cursor | not started | | Timing NOT VERIFIED |
| P9 | Shared response cache | not started | | |
| P10 | Shared exchange-rate cache | not started | | |
| P15 | Index migration files, never applied | not started | | Timing NOT VERIFIED |

### Known flaky tests, not regressions

`npm test` is green on an idle machine but two wall-clock tests fail when the machine is busy, because
they assert a real elapsed-time budget:

| test | assertion | observed under load |
|---|---|---|
| `apps/student-web/src/lib/storage.timeout.test.ts` | upload gives up in under 3000 ms | 3598 ms and 3775 ms |
| `apps/teacher-web/src/lib/outbound.timeout.test.ts` | email returns within 10 s | vitest's own 5000 ms test timeout |

Both pass when re-run on their own, on the same code. Re-run them in isolation before treating either as a regression.

## Headline findings

Ranked by expected impact. Full evidence in `PERF_BASELINE.md`.

| id | Finding | Verdict |
|---|---|---|
| F1 | Every authenticated page waits for `/api/auth/me` before its own fetch can start, because `AppShell` does not mount children while loading. Two serial cross-ocean round trips before anything renders | CONFIRMED by code; timing NOT VERIFIED |
| F2 | No Vercel region pinned. Supabase is in **Tokyo at 141 ms p50 from India**, Upstash in Mumbai at 27.9 ms. Moving Vercel to Mumbai would not fix it; the database is the far thing | CONFIRMED; Vercel's own region NOT VERIFIED |
| F3 | Both login rewrites are dead for logged-out users, and unreferenced | CONFIRMED by measurement |
| F4 | Expired access token turns one navigation into 3 requests plus a Redis and a Postgres hop | CONFIRMED |
| F5 | Discover loads every review row per teacher for one average, and runs an unanchored `ILIKE` | CONFIRMED |
| F6 | Student dashboard loads every booking ever made to emit five plus five rows and three numbers | CONFIRMED |
| F7 | Recordings route pulls whole `User` rows, including `passwordHash` and `totpSecret`, and uses no field from them | CONFIRMED |
| F8 | teacher-web ships all of zod, 63.1 KB gzipped, to every authenticated page via `AppShell`. Same screen: 380.3 KB there against 208.6 KB in student-web | CONFIRMED by measurement |
| F9 | Sidebar and TopBar both fetch the unread count on every student-web page load | CONFIRMED |
| F10 | Dead student-search branch in student-web's command palette. Gated off, so it never fires | CONFIRMED as dead code only. A first reading that called it a live 404 was wrong and is corrected in the baseline |
| F11 | Dashboards poll every 60 s with no visibility guard; TopBar refetches on every window focus | CONFIRMED |
| F12 | The response cache replays stored headers and cannot invalidate across instances | CONFIRMED |
| F13 | 56 `findMany` calls without `take`. 19 are off limits, so 37 actionable. The wallet route is already bounded, contrary to the suspect | CONFIRMED |
| F14 | Exchange rates come from a third party through a per-instance cache, on the discover path; up to about 32 outbound calls on a cold instance | CONFIRMED by code |

## Suspects that did not survive

Recorded so they are not re-investigated.

- **Proxy JWT cost is not a bottleneck.** `importSPKI` measures 0.059 ms p50, the whole verify path 0.253 ms. Page latency with and without verification is 5.2 ms against 4.9 ms p50, inside the noise.
- **`window.location`, internal `<a href>`, `router.refresh()` and layout remounting are all effectively absent.** One `window.location` call and it is a correct cross-origin jump; three anchors, all cosmetic; four `router.refresh()` calls, all appropriate; both apps use real route-group layouts that survive navigation.
- **No cross-app API calls.** Every client fetch is a relative path, so each app calls itself. The duplication costs bundle weight and maintenance, not latency.
- **The schema is mostly well indexed.** `Notification`, `CoinTransaction`, `ChatMessage`, `ClassSession` and `Review` already carry the composite their hot query needs. Gaps are on `TeacherProfile` and `Booking` only.

## Measurement limits that apply to everything

No local or test Postgres exists and production is off limits, so **no API timing, query count or query plan was measured**. Playwright has no browser binaries, so **no request count was observed in a browser** and there is no Lighthouse data; request counts are derived from reading the client components. Payload sizes, redirect hop counts and CPU-bound microbenchmarks are really measured. Scripts are in the session scratchpad, listed at the end of `PERF_BASELINE.md`.

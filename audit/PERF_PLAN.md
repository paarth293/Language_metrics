# PERF_PLAN.md — Step 2 (DECIDED, go given)

Branch `fix/perf` @ `c5a8b5f`. Findings and evidence are in `PERF_BASELINE.md`; this document is only the plan.

**Go received.** Progress is tracked in `PROGRESS_PERF.md`; results are in `PERF_REPORT.md`.

---

## Decisions received, and what they changed in this plan

| id | Decision | Effect on the plan below |
|---|---|---|
| D1 | Silent-refresh chain: **leave as is**, it is auth code | **P-silent-refresh dropped.** Recorded as a follow-up for a separate auth batch |
| D2 | Login rewrites: **leave as is** | **P12 reduced.** `apps/teacher-web/next.config.ts` is not touched. Only the dead command-palette branch is removed |
| D3 | Review aggregate: **`groupBy` / `_avg` / `_count`, no schema change** | P5 proceeds as Option A. Stored `ratingAvg`/`ratingCount` is a follow-up only if measured numbers justify it, and no number can be measured here, so it stays a follow-up |
| D4 | Exchange-rate cache: **no new dependency** | P10 proceeds as Option A, an injected cache adapter |
| — | **Recordings narrow select goes first**, with an explicit finding on whether `passwordHash` or `totpSecret` can reach a response | Promoted to **P1** and done first. The exposure analysis is in `PERF_REPORT.md` |
| — | AppShell: **render shell and children immediately**, auth check in parallel or user passed from the server, **authorization stays on the server**, proven by a test that an unauthenticated request still gets no protected data | P3 gains that test as a hard requirement |
| — | teacher-web: **remove zod from the shared shell**, show before/after `next build` sizes | P11 proceeds, measured |
| — | **P14 (proxy public key) is not authorised.** No confirmation was given to open `proxy.ts`, and it measured at 0.059 ms | **P14 dropped**, recorded as a follow-up for the auth batch |

## Measurement constraint, as instructed

**There is no local or test database, and none will be created.** No Postgres or Docker was installed, the production `DATABASE_URL` was not read or used, and no query was run against any real database.

What that permits and forbids:

| Measurable here | Not measurable here |
|---|---|
| First-load and chunk sizes from a real `next build` | Query latency, in milliseconds |
| Request counts per page load, derived from the client components | `EXPLAIN ANALYZE` plans, before or after |
| Query **counts** and the **column and row sets** a query asks for, asserted in tests | Index effectiveness |
| Outbound third-party call counts, with the HTTP layer stubbed | End-to-end page latency |

Every database-side item therefore ships with **NOT VERIFIED** for timing, plus a note on how to measure it later. No millisecond figure is estimated anywhere.

For context on what a later measurement would have to account for: the baseline measured Supabase Postgres in Tokyo at **141 ms p50 TCP handshake from India**, so each serial round trip a change removes is worth roughly that much, per request. That is a baseline network measurement, not a claim about any fix.

---

## Original gate, kept for the record

Four items needed a decision because the fix lands inside code the rules put off limits. The decisions above resolve all four.

---

## Baseline checks on this branch, before any change

| check | result |
|---|---|
| `npm run typecheck` | 0 errors |
| `npm run lint` | 0 errors, 0 warnings |
| `npm test` | 766 passed, 0 failed |
| `npm run test:payments` | 217 passed, 0 failed, 2 skipped |

The baseline is fully green, so the "known #12 failure" allowance no longer applies. After every commit I will run all four and undo anything that breaks any of them.

---

## Part A — Decisions I need from you first

### D1. The silent-refresh chain (finding F4) is auth logic. I cannot touch it.

An expired access token costs **3 HTTP requests** for one navigation, plus a Redis round trip to Mumbai and a Postgres round trip to Tokyo in the middle hop. The whole fix lives in `apps/teacher-web/src/app/api/auth/silent-refresh/route.ts` and `apps/teacher-web/src/proxy.ts`, which your rules exclude.

- **Option A — leave it completely alone.** Report the 3 hops in the final report and move on. Zero risk to auth and payments. The chain stays as it is for every active teacher and student on teacher-web.
- **Option B — I prepare the change but do not apply it.** I write a patch plus tests into `audit/` as a proposal you review and apply yourself. The change would refresh in place rather than by redirect, so the navigation costs 1 request instead of 3. It rewrites session rotation, which is precisely the code that was hardened in `e1ca356`, so I would not run it without you reading it line by line.

**My recommendation: Option A for now.** The access-token lifetime is the real lever here and it is a config value, not code. If you tell me what `accessCookieOptions` maxAge is set to in production, that may be a better place to look than the refresh path.

### D2. Making `/teacher/login` and `/student/login` work needs the proxy's protected-prefix list (finding F3)

Those two rewrites never fire for a logged-out visitor, because `PROTECTED_PREFIXES` in `apps/teacher-web/src/proxy.ts:17` catches them first. Nothing in the repo links to either path.

- **Option A — delete both rewrites from `apps/teacher-web/next.config.ts`.** No auth code touched. Behaviour is unchanged for anyone with an old bookmark, because the proxy already sends them to `/login` and still would. This is dead-config cleanup with **no latency benefit**, and I will not claim one.
- **Option B — exclude the two login paths from the protected prefixes** so the rewrite works. This edits the proxy's authorization decision, which is off limits, and a mistake in that list is an auth hole. I would add tests asserting that every other `/teacher/*` and `/student/*` path still redirects.

**My recommendation: Option A.** The URLs are unreferenced, so Option B buys correctness for a path nobody navigates to, at auth risk.

### D3. Stored `ratingAvg` / `ratingCount` on `TeacherProfile` is a schema change (finding F5)

Discover loads every review row per teacher to compute one average.

- **Option A — aggregate query, no schema change.** Replace the `reviews` include with a `Review.groupBy({ by: ["teacherId"], _avg: { rating }, _count: true })` scoped to the teacher ids on the page. Served by the existing `@@index([teacherId, rating])`. Response shape identical. **No approval needed beyond "go".**
- **Option B — denormalised `ratingAvg` and `ratingCount` columns**, maintained on review create, update and delete. Makes discover a single query with no aggregate, but it is a schema change plus a backfill plus write-path changes, and it can drift from the truth.

**My recommendation: Option A now, revisit B only if measurements later justify it.** A is strictly a subset of B's benefit and carries none of its risk.

### D4. Sharing the exchange-rate cache (finding F14) touches `packages/currency`

A cold instance can make up to about 32 outbound calls to `api.frankfurter.dev` to answer one filtered discover request, because the rate cache is a per-instance `Map`.

- **Option A — dependency injection, no new dependency.** `packages/currency` gains an optional cache adapter parameter; the apps pass a Redis-backed adapter built from their existing `redis-client.ts`. `packages/currency` itself stays dependency-free and its current tests keep passing with the default in-memory adapter.
- **Option B — add `ioredis` to `packages/currency`.** Simpler code, but it adds a dependency to a workspace that has none and couples a pure utility package to infrastructure. Your rules say to ask before adding dependencies, so this is the ask.

**My recommendation: Option A.** No new dependency anywhere, and the package stays testable without Redis.

---

## Part B — Report only, no code

### P1. Region (finding F2). I will not change anything; here is what I would change and why.

Measured: Supabase Postgres is in **Tokyo** and answers a TCP handshake from India in **141 ms p50**. Upstash Redis is in **Mumbai**, 27.9 ms. No Vercel region is pinned in the repo, so functions run in the project default, which Vercel documents as **iad1, Washington D.C.**

The suspect assumed a wrong Vercel region is the whole problem. It is half of it. The database being in Tokyo is the other half, and it is the half that survives any Vercel change.

| Vercel region | user to Vercel | Vercel to Postgres | per request, with N serial queries |
|---|---|---|---|
| `iad1` Washington, today's likely default | slowest leg for India | crosses the Pacific | worst on both legs |
| `bom1` Mumbai | best, roughly 20-30 ms | about 141 ms, measured from India | still 141 ms times N |
| `hnd1` Tokyo, what `5b72d35` set and `4ce6b0f` removed | roughly 120 ms, one round trip | a few ms, same region | best available without a data migration |

Because finding F1 means a cold page load makes **two serial** database-backed calls, the per-query term is multiplied, which is what makes co-location matter more than user proximity.

**What I recommend you do in the dashboards, in this order:**

1. **Now, one setting, no migration: set the function region to `hnd1` for all three Vercel projects.** This restores what `5b72d35` intended and co-locates functions with the database. You can do it in Project Settings or by adding `"regions": ["hnd1"]` to each app's `vercel.json`. Note that `apps/student-web/src/vercel-config.test.ts` currently asserts no region is pinned, so that test has to change in the same commit; I have not touched it.
2. **Confirm the current region first**, because everything above assumes `iad1`. Project Settings, Functions, Region. I cannot read it from here, so this is **NOT VERIFIED**.
3. **Later, if you want the best outcome for Indian users: move Supabase to `ap-south-1` and Vercel to `bom1`.** Supabase cannot change a project's region in place; you create a project in the new region and migrate the data, and third-party runbooks budget a maintenance window of a few hours. That is a project, not a setting. Upstash is already in Mumbai, so it would become same-region too.
4. **Do not pin multiple regions.** Vercel limits Pro to three, and splitting functions across regions while the database sits in one just makes latency depend on which region served you.

I am not touching Vercel settings, `vercel.json`, or `vercel-config.test.ts` unless you tell me to.

### P2. LiveKit (finding F7 in your list, F-numbered 7 in the baseline). Report only, as instructed.

`packages/livekit/src/server.ts:213-216` calls `listRooms([name])` then `createRoom(...)` on every join. `createRoom` is idempotent for an existing room name, so the `listRooms` probe is avoidable. I am not changing it and not proposing a change, per your rules.

---

## Part C — The work, highest impact first

Every item below: one small commit, then `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:payments`. Any failure other than the 2 known skips and I undo and tell you.

A note on measurement that applies to all of Part C: **no database-side improvement can be measured in this environment.** There is no local or test Postgres and production is off limits, so for every query change I can show the query plan shape, a unit test, and the row counts the code now requests, but I cannot show a before and after millisecond figure. Payload and request-count changes **can** be measured, with the same scripts as the baseline. Each item says which it is.

> **Settled: there is no database to measure against, and none is being created.** Items P3, P5, P6, P7 and P8 ship with NOT VERIFIED for timing. What each one *does* prove is a query count, a column set or a row set, asserted in a test, which is a real before-and-after even though it is not a millisecond figure.

### P3. Break the serial auth waterfall (finding F1) — highest impact

| | |
|---|---|
| Files | `apps/student-web/src/components/layout/AppShell.tsx`, `apps/teacher-web/src/components/layout/AppShell.tsx`, plus a `loading.tsx` or skeleton per authenticated route group |
| Change | Stop returning a full-screen spinner instead of `{children}`. Render the real shell immediately with a skeleton in the content area, so each page mounts and starts its own fetch **in parallel** with `/api/auth/me` rather than after it. Keep the existing `router.replace("/login")` for the resolved-and-unauthenticated case |
| Expected benefit | Removes one full serial round trip from every cold authenticated page load. At the measured 141 ms per database round trip that is of the order of 141 ms plus one query, on every such load. **Magnitude NOT VERIFIED without a database** |
| Risk | **Medium, the highest in this plan.** Pages currently mount only after `user` is known. Any page that assumes a non-null user or that fires a request which 401s before auth settles will need handling. I will audit all 16 student-web and 20 teacher-web authenticated pages before changing the shell, and if any page genuinely needs the user first I will leave that page gated rather than force it |
| Measured how | Request waterfall derived from code before and after, plus a unit test asserting children mount while `isLoading` is true. Wall-clock is not measurable here |
| Caching | none |

Your Step 3a explicitly asks for localized `loading.tsx` and Suspense instead of full-page spinners, so I am treating the visual change from spinner to skeleton as already authorised. Tell me if not.

### P4. Remove the duplicate unread-count fetch (finding F9)

| | |
|---|---|
| Files | `apps/student-web/src/components/layout/Sidebar.tsx` |
| Change | Delete the Sidebar's own `fetch` at `:36`. It already listens for the `notifications-updated` event the TopBar dispatches; have the TopBar dispatch its first result too, or lift the count into the existing context. teacher-web is already correct and will not be touched |
| Expected benefit | One fewer request on every authenticated student-web page load, measured by count, not guessed. Two identical calls become one |
| Risk | **Low.** The badge could show 0 briefly if the event ordering is wrong; a test will cover the first-paint value |
| Measured how | Request count per page load, derived from code, before and after. Unit test on the Sidebar's initial count |
| Caching | none |

### P5. Replace the discover review scan with an aggregate (finding F5, decision D3 Option A)

| | |
|---|---|
| Files | `apps/student-web/src/app/api/students/discover/route.ts`, `apps/teacher-web/src/app/api/students/discover/route.ts` |
| Change | Drop the `reviews` include. Add one `Review.groupBy({ by: ["teacherId"], where: { teacherId: { in: pageTeacherIds } }, _avg: { rating: true }, _count: { rating: true } })` after the page is sliced, and map it in. Response shape byte-identical: `rating` stays a one-decimal number, `reviews` stays a count |
| Expected benefit | Rows transferred per discover request drop from "every review of every teacher on the page" to one row per teacher. Served by the existing `@@index([teacherId, rating])`. **Latency NOT VERIFIED without a database** |
| Risk | **Low.** One behaviour difference to get right: today a teacher with no reviews gets `rating: 0` and `reviews: 0` from an empty array; `groupBy` returns no row for them, so the mapping must default to the same values. A test will pin exactly that |
| Measured how | Unit test on the mapping including the zero-review case; row count reasoned from the query. No timing |
| Caching | none of its own; interacts with P9 |

### P6. Stop fetching whole `User` rows in the recordings route (finding F7)

| | |
|---|---|
| Files | `apps/student-web/src/app/api/students/recordings/route.ts`, `apps/teacher-web/src/app/api/students/recordings/route.ts` |
| Change | Replace `include: { user: true }` with an explicit `select` of the two fields the response actually uses, `teacher.name` and `teacher.language`. Add `take` with a cursor |
| Expected benefit | Stops moving every `User` column, including `passwordHash`, `totpSecret`, `backupCodes` and both reset tokens, from Tokyo into function memory once per recording, for zero use. Also bounds a list that currently grows without limit. Smallest change with the clearest justification in this plan |
| Risk | **Low**, and it reduces exposure rather than adding any |
| Measured how | Response body compared field by field before and after, asserting it is unchanged; a test asserting the selected columns |
| Caching | none |

### P7. Bound the student and teacher dashboards (finding F6)

| | |
|---|---|
| Files | `apps/student-web/src/app/api/students/dashboard/route.ts`, `apps/teacher-web/src/app/api/students/dashboard/route.ts` |
| Change | Stop loading every booking. Compute the three statistics with database aggregates (`count`, `aggregate`, `groupBy`) and fetch only the rows the response actually returns: the next five upcoming and the five most recent. All of it stays inside the existing `Promise.all`, so the number of serial round trips does not increase |
| Expected benefit | Rows per dashboard request stop growing with account age. Response values stay **identical**, since the aggregates compute the same numbers the JavaScript does today |
| Risk | **Medium.** The statistics are currently derived in JavaScript across all bookings, including `totalHours` from `scheduledEnd - scheduledStart` over completed sessions only, and a `uniqueTeachers` set. Each has to be reproduced exactly in SQL or the numbers on the dashboard change. I will write tests that pin the current values from a fixture first, then refactor until they still pass |
| Measured how | Tests pinning each statistic against a fixture, shown passing before and after. Row counts reasoned. No timing |
| Caching | none |

### P8. Add `take` and cursors to the remaining unbounded lists (finding F13)

37 actionable sites; the 19 in `packages/live-classes` are excluded.

| | |
|---|---|
| Files | student-web and teacher-web: `students/classes`, `students/complaints`, `students/chat`, `v1/classes`, `v1/me`, `students/teacher/[id]`, `teachers/schedule`, `teachers/wallet`, `features/teacher/services/teacher-service.ts` |
| Change | Add `take` plus a cursor, following the pattern `lib/discover-query.ts` already establishes, so pagination is additive: existing callers that send no cursor keep getting the first page in the same shape. `pagination: { nextCursor, hasMore }` is added alongside, never replacing an existing key |
| Expected benefit | Bounds worst-case payload and query time on every one of these routes |
| Risk | **Medium, because of the mobile contract.** `/api/v1/classes` and `/api/v1/me` are consumed by `apps/student-mobile`. Your rules require the mobile contract to stay unchanged, so for those two the limit will be generous and the response shape purely additive. I will read the mobile client's usage before touching either, and if a bound would change what the app shows I will leave it and tell you |
| Measured how | Per-route tests asserting the first page is unchanged without a cursor, and that a cursor walks the list |
| Caching | none |
| Admin panel | **Deferred, and I want to flag it rather than quietly do it.** The 16 admin sites are server components that render whole tables; bounding them is a visible UI change needing pagination controls. I propose a separate commit that adds only a high safety cap with explicit ordering and no UI change, leaving real pagination for a later phase. Say if you would rather I skip admin entirely |

### P9. Replace `api-cache.ts` with a shared cache (findings F2, F12)

| | |
|---|---|
| Files | `apps/student-web/src/lib/api-cache.ts`, `apps/teacher-web/src/lib/api-cache.ts`, both `students/discover/route.ts`, both `students/teacher/[id]/book/route.ts`, both `students/classes/[id]/reschedule/route.ts` |
| Change | Back the cache with the existing Upstash Redis client rather than a per-process `Map`. Store **only the response body and status, never the headers** — the current code replays stored headers to the next caller, which is the one genuine cross-user hazard in the cache today |

**Caching policy, in full, because you asked for it explicitly:**

| | |
|---|---|
| What is cached | `GET /api/students/discover` only. Nothing else gets a shared cache in this plan |
| Why it is safe to share | The discover body is a function of the validated query and the viewer's currency, and of nothing else about the viewer. Authorization is checked by `requireAuth` **before** the cache is consulted, at `route.ts:21` versus `:65`, so a cache hit never substitutes for an auth check |
| Key | `disc:v1:{ver}:{sha256(canonical validated query)}:cur={currency}` |
| Currency | already part of the key today and stays there. A student who prefers USD can never be served INR conversions |
| TTL | **60 s**, unchanged from the current `Map` TTL, so this introduces no new staleness |
| Invalidation | an integer version key `disc:ver` is folded into every cache key. Any mutation that can change discover output does a single `INCR disc:ver`, which retires every entry at once, across all instances, with no `SCAN`. Today's `invalidateCache("discover:")` only reaches the one instance that served the write |
| Invalidated on | booking create, teacher profile update, teacher status or approval change, rate change, availability change, review create, update and delete. I will grep for every writer of `TeacherProfile`, `TeacherRate`, `TeacherAvailability` and `Review` and add the `INCR` to each, rather than guessing the list |
| Stored value | body string and status only. Headers are dropped. Only `status === 200` is stored |
| Never cached | anything keyed to a single user, authorization results, wallet or coin balances, booking state, payment or order state, sessions, Cashfree anything, LiveKit tokens. I will add a short comment in `api-cache.ts` saying so, so the next person does not widen it |
| Redis unavailable | the helper falls through to computing the response. A cache outage must never turn into an error or an auth bypass |

| | |
|---|---|
| Expected benefit | The cache starts working at all. Today, with per-instance Maps on Vercel, the hit rate is near zero for a spread-out user base and invalidation does not propagate |
| Risk | **Medium-high, the one item here with cross-user consequences if I get it wrong.** Mitigations: body-and-status only, currency in the key, auth before cache, version-counter invalidation, a test that two different users with different currencies never share an entry, and a test that a review write retires the entry |
| Measured how | `X-Cache` HIT and MISS counts across a sequence of requests locally. A true hit-rate figure needs production traffic and is **NOT VERIFIED** |

### P10. Shared exchange-rate cache (finding F14, decision D4 Option A)

| | |
|---|---|
| Files | `packages/currency/src/index.ts`, plus a small adapter in each app |
| Change | Give `getExchangeRate` an optional cache adapter. Apps pass a Redis-backed adapter; the default stays the current in-memory `Map` so existing tests and any non-app caller are unaffected |
| Caching | key `fx:v1:{FROM}_{TO}`, TTL **6 h** unchanged, invalidation by TTL only. Public reference data, so no user keying is needed or wanted. The existing stale-on-failure fallback is preserved |
| Expected benefit | A cold instance stops re-fetching up to about 32 rate pairs from a free third-party service to answer one filtered discover request |
| Risk | **Low.** Worst case on a Redis miss is today's behaviour |
| Measured how | Count of outbound rate fetches for a cold filtered discover request, before and after, with the HTTP call stubbed in a test |

### P11. Trim the teacher-web bundle (finding F8) — the most measurable item here

| | |
|---|---|
| Files | `apps/teacher-web/src/components/layout/AppShell.tsx`, `apps/student-web/next.config.ts` |
| Change | Load `DateOfBirthPrompt` with `next/dynamic` so zod leaves the shared shell chunk and arrives only for the users who actually see the prompt. Separately, add `framer-motion` to student-web's `optimizePackageImports`, which teacher-web already has |
| Expected benefit | Target is most of the **63.1 KB gzipped** zod chunk off every authenticated teacher-web page. `/student/dashboard` is 380.3 KB gzipped today against 208.6 KB for the same screen in student-web |
| Risk | **Low.** The prompt renders conditionally already. Risk is a flash before the chunk arrives, which a small fallback handles |
| Measured how | **Properly measurable.** `jsweight2.mjs` and `chunks.mjs` re-run against a fresh production build, same method as the baseline, reporting first-load gzipped bytes per route before and after |
| Caching | none |

### P12. Dead code (finding F10 only; F3 left alone per D2)

| | |
|---|---|
| Files | `apps/student-web/src/components/layout/CommandPalette.tsx` |
| Change | Remove the unreachable student-search branch from student-web's `CommandPalette`, which is gated `canSearchStudents={false}` at its only call site and points at a route this app does not have. **`apps/teacher-web/next.config.ts` is not touched**: per D2 the two dead login rewrites stay exactly as they are |
| Expected benefit | Honestly: **no measurable latency win.** A small bundle saving from the dead branch, and two fewer pieces of misleading config. Included because it is cheap and because leaving a broken rewrite in place invites someone to "fix" it in the proxy later |
| Risk | **Low** |
| Measured how | First-load bytes for student-web routes, same method as the baseline |

### P13. Stop polling hidden tabs (finding F11)

| | |
|---|---|
| Files | `apps/student-web/src/app/(authenticated)/dashboard/page.tsx`, `apps/teacher-web/src/app/teacher/dashboard/page.tsx`, `apps/teacher-web/src/app/teacher/schedule/page.tsx`, `apps/student-web/src/components/layout/TopBar.tsx` |
| Change | Skip the interval tick while `document.hidden`, and refetch once on becoming visible again. On the TopBar's `focus` handler, add a minimum interval so rapid window switching does not produce a request per switch |
| Expected benefit | Removes a request per minute per abandoned tab, indefinitely. This is server load and mobile battery rather than page speed |
| Risk | **Low.** Keep the refetch-on-visible so data is never staler than it is today. Does not touch the chat polling you fixed |
| Measured how | Test with a faked `document.hidden` asserting no fetch while hidden and exactly one on becoming visible |

### P14. ~~Cache the proxy's public key~~ — DROPPED, not authorised

This item required explicit confirmation to open `apps/teacher-web/src/proxy.ts`. No confirmation was given, so it is **not done** and is recorded as a follow-up for the auth batch. The measurement below is why it was last on the list anyway.

| | |
|---|---|
| Files | `apps/teacher-web/src/proxy.ts` |
| Change | Memoize the `importSPKI` result at module scope instead of re-importing per request |
| Expected benefit | **Measured at 0.059 ms p50 per protected request.** I am listing this to close the suspect out, not because it will be felt. It is 20 lines down this list for a reason, and I will not report it as a win |
| Risk | **Low in code, but it is inside `proxy.ts`**, which is auth-adjacent. It changes no authorization decision, only where the parsed key is stored. If you would rather I not open that file at all, say so and I will drop P14 entirely |
| Measured how | The same `jose-bench.mjs` microbenchmark, plus the page-latency table. The page-level effect is inside the noise at this scale and I expect to report it as not measurable |

### P15. Index migration files (finding on index gaps)

| | |
|---|---|
| Files | new directories under `packages/database/prisma/migrations/`, one index per file, each with `CREATE INDEX CONCURRENTLY` and a matching `rollback.sql` |
| Indexes | `TeacherProfile (status, createdAt DESC)` for the discover sort; `TeacherProfile (onboardingComplete)` or a composite with `status`; `Booking (studentId, createdAt DESC)` and `Booking (teacherId, createdAt DESC)` for the sorted lists after P7 and P8 |
| Trigram index | a `pg_trgm` GIN index on `TeacherProfile.name` would be the fix for the `ILIKE '%term%'` scan, but it needs the `pg_trgm` extension enabled. **I will write the file and flag it separately; enabling an extension on your database is your call, not mine** |
| Expected benefit | Filter-plus-sort served from one index instead of a sort step. **NOT VERIFIED: no `EXPLAIN` was run and none can be** |
| Risk | **None to the running app, because I will not apply them.** Files only, per your rules. `CREATE INDEX CONCURRENTLY` cannot run inside a transaction, so each file carries a note that `prisma migrate` needs the appropriate handling |
| Measured how | Not measurable here. The honest statement in the final report will be that these are proposed from query shape and unverified against a real plan |

---

## What I will not do

- Touch `packages/live-classes`, Cashfree code, webhook routes, auth token, refresh or session logic, `packages/livekit`, or anything under `tests/payment-security`. The 19 unbounded `findMany` calls inside `packages/live-classes` are excluded from P8 for this reason.
- Touch the marketing homepage, `features/home/*` or `app/(public)/page.tsx`. Its 179.3 KB of HTML is reported and left alone.
- Change any Vercel setting, `vercel.json`, or `apps/student-web/src/vercel-config.test.ts`.
- Apply any migration, or run anything against the production database or Redis.
- Add a dependency or a paid service. D4 Option A exists specifically to avoid one.
- Re-do chat pagination and polling, thread-list queries, the shared rate-limit client, session and OTP Redis handling, outbound timeouts, the JSON logger, Sentry, env validation, or the cron lock.
- Cache anything user-specific, role-specific, or payment-related in a shared cache.
- Quote an improvement without a before and after from the same method. Where timing cannot be measured here, the final report will say NOT VERIFIED rather than estimate.

---

## Order of work, if you say go

1. P11 and P12, bundle and dead code. Fully measurable, lowest risk, so they also prove the measurement harness end to end.
2. P4, P6, P13. Small, self-contained, obviously correct.
3. P3, the serial waterfall. Highest impact, highest care, done after the easy wins are banked.
4. P5, then P7, then P8. Query shape, in rising order of behavioural risk.
5. P9 and P10, caching. Last of the code changes, because they are the ones that can leak across users if rushed.
6. P14 only if you confirm you are happy for me to open `proxy.ts`.
7. P15, migration files, written but never applied.
8. Re-measure everything with the baseline scripts, then write `PERF_REPORT.md`.

`audit/PROGRESS_PERF.md` gets a row after each item, so "continue" resumes from it.

---

## Order of work, as actually executed

The order below supersedes the list above, because the recordings select was promoted to first.

1. **P1** recordings narrow select, plus the credential-exposure analysis.
2. **P11** teacher-web zod out of the shared shell, and **P12** dead code. Fully measurable from `next build`.
3. **P4** duplicate unread-count fetch, **P13** hidden-tab polling.
4. **P3** AppShell, with the unauthenticated-access test.
5. **P5** discover aggregate, **P7** dashboard aggregates, **P8** bounded lists.
6. **P9** shared response cache, **P10** shared exchange-rate cache.
7. **P15** index migration files, written and never applied.

## Follow-ups handed back, not done here

| Item | Why it was not done |
|---|---|
| Silent-refresh chain, 3 requests per expired-token navigation | D1: auth code, deferred to a separate auth batch |
| Proxy public-key memoization (old P14) | Opening `proxy.ts` was not authorised. Measured at 0.059 ms, so the cost of leaving it is negligible |
| Dead `/teacher/login` and `/student/login` rewrites | D2: left as is |
| Stored `ratingAvg` / `ratingCount` columns | D3: needs measured numbers to justify a schema change, and no number is measurable here |
| Vercel function region, and the Supabase region | Dashboard settings and a data migration. Report only, see P1 above |
| LiveKit `listRooms` probe per join | Off limits by rule |
| Admin-panel unbounded table queries | Visible UI change; needs pagination controls |
| Timing for every database-side item | No database. Each item says how to measure it later |

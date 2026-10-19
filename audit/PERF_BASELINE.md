# PERF_BASELINE.md — Step 1: measure only

Branch `fix/perf`, made from `fix/phase3-security` @ `c5a8b5f`.
Date 2026-10-20. **No application code was changed for this document.**

---

## 1. How this was measured, and what could not be measured

### What ran

| | |
|---|---|
| Build | real `next build` (Next.js 16.3.8, Turbopack) for student-web and teacher-web, both exit 0 |
| Serve | real `next start`, production mode, student-web :3002, teacher-web :3000 |
| Env | `__NEXT_PROCESSED_ENV=true` so Next skipped the apps' `.env` files, which hold the **production** Supabase and Upstash credentials |
| Database | a dead local address, `127.0.0.1:5999`. Nothing in this session connected to production Postgres or Redis |
| Tokens | a throwaway RSA-2048 keypair generated in the scratchpad, used to mint test JWTs so authenticated routes could be reached. The real `JWT_PRIVATE_KEY` was never read or used |
| Latency | timed `fetch` from Node, 40 samples per path after 5 discarded warm-ups, p50/p95 reported |
| Network | TCP handshake timing only to the Supabase and Upstash hostnames: socket open, time, close. No credentials, no protocol handshake, no query |

### What could NOT be measured, and why

These are marked **NOT VERIFIED** throughout and no number is invented for them.

1. **Every API timing and query count.** There is no local or test database. `DATABASE_URL` and `DIRECT_URL` in `.env`, `apps/*/.env` and `packages/database/.env` all point at the same production Supabase pooler. Docker, `psql` and any local Postgres are absent. The rules forbid running against production, so no `/api/*` route was executed with a working database. Prisma query logging produced nothing.
2. **Request count per navigation in a real browser.** Playwright is installed at version 1.63.0 but **no browser binaries are present**. Per the brief this fell back to timed curl, so request counts below are derived by reading the client components, not observed. Each one says so.
3. **Lighthouse and Core Web Vitals.** No browser, so no LCP, CLS or TBT.
4. **Production query plans.** No `EXPLAIN` was run. Index gaps are reasoned from the query shape against the committed schema.
5. **The Vercel side of the region finding.** The Vercel dashboard cannot be read from here, and latency from a Vercel region to Supabase cannot be measured from this machine.
6. **Cold vs warm on Vercel.** Local `next start` has no cold starts. Everything below is a warm local server; Vercel cold-start cost is not measured.

Local numbers are useful for payload size, redirect hop counts and CPU-bound work. They say nothing about production database latency.

---

## 2. Your ten suspects, adjudicated

| # | Suspect | Verdict | Evidence |
|---|---|---|---|
| 1 | Discover loads every review row; ILIKE on name | **CONFIRMED** | `apps/student-web/src/app/api/students/discover/route.ts:83-85` loads all reviews, `:97-100` and `:159` only need an average and a count. `apps/student-web/src/lib/discover-query.ts:88` builds an unanchored `contains` |
| 2 | `api-cache.ts` is a per-instance Map | **CONFIRMED** | `apps/student-web/src/lib/api-cache.ts:15`. Its own header at `:7` says "For production with multiple instances, replace with Redis cache". A **second** per-instance cache with the same flaw sits on the same path: `packages/currency/src/index.ts:53` |
| 3 | ~57 `findMany` without `take` | **CONFIRMED, 56 found** | Census in F13. 27 calls do have `take`. Of the 56, **19 are inside `packages/live-classes`, which is off limits**, so 37 are actionable |
| 4 | teacher-web proxy verifies a JWT on every request; public pages wrongly protected | **cost NOT CONFIRMED; wrong-protection PARTLY CONFIRMED** | Measured: the uncached `importSPKI` costs **0.059 ms** p50 and the whole verify path **0.253 ms** p50. Page latency with verification (5.2 ms p50) is inside the noise of the same page without it (4.9 ms p50). It is waste, not a bottleneck. Separately, two paths **are** wrongly treated as protected: see F3 |
| 5 | Redirect chains | **CONFIRMED** | Measured hop counts in section 6. Worst real case is **3 requests for one navigation** whenever the access token has expired |
| 6 | The same student API exists in both apps | **CONFIRMED, 36 routes** | 36 identical route paths. teacher-web also carries a **complete duplicate student UI** at `/student/*`. But **no cross-app call happens**: every client fetch is a relative path, so each app calls itself. The latency claim in the suspect is NOT CONFIRMED; the cost is bundle weight and double maintenance |
| 7 | Every live-class join makes 2 LiveKit API calls | **CONFIRMED (report only)** | `packages/livekit/src/server.ts:213` `listRooms([name])` then `:216` `createRoom(...)`. Not touched, not proposed for change |
| 8 | Vercel region | **CONFIRMED, and worse than described** | No region is pinned anywhere in the repo. Supabase is in **Tokyo**, Upstash in **Mumbai**, users in India. Measured RTTs in section 7 |
| 9 | Possible full reloads | **PARTLY CONFIRMED** | The specific causes you listed are mostly absent. What is real is a different mechanism: a full-screen spinner gating a serial request waterfall. See F1 and the point-by-point table in section 4 |
| 10 | Missing indexes on hot paths | **PARTLY CONFIRMED** | The schema is better indexed than expected. `Notification`, `CoinTransaction`, `ChatMessage`, `ClassSession` and `Review` all carry the composite index their hot query needs. Real gaps are on `TeacherProfile` and `Booking` only. Query plans NOT VERIFIED |

---

## 3. Findings ranked by impact

Impact ranking assumes Indian users and the measured 141 ms per database round trip. Where impact rests on an unmeasured database, it says so.

### F1 — Every authenticated page waits for two serial cross-ocean round trips before rendering anything
**CONFIRMED by code structure. Time cost NOT VERIFIED (no database).**

`apps/student-web/src/components/layout/AppShell.tsx:36-47` returns a full-screen spinner while `isLoading || !user`, so `{children}` is **not mounted**. The page component's own `useEffect` therefore cannot start its fetch until `/api/auth/me` has resolved. Same shape in `apps/teacher-web/src/components/layout/AppShell.tsx`.

The chain for a cold load of, say, `/dashboard`:

1. static HTML, fast
2. 208 KB of gzipped JS (measured, section 5)
3. `GET /api/auth/me` → `db.user.findUnique` with a joined `studentProfile` (`apps/student-web/src/app/api/auth/me/route.ts:28`) → **one database round trip**
4. only now does the dashboard mount and fire `GET /api/students/dashboard` → **another database round trip**

Two round trips that cannot overlap, because step 4 is gated on step 3. At the measured 141 ms per round trip that is roughly 282 ms of pure network before any content, before query time, before cold start. This is the mechanism behind "slow navigation", and it is architectural rather than any single slow query.

`requireAuth` itself is clean: `apps/student-web/src/lib/auth.ts:57-102` is pure JWT verification with no database call.

### F2 — No Vercel region is pinned, and the database is in the wrong hemisphere
**CONFIRMED. The Vercel-side leg is NOT VERIFIED.**

Measured from this machine in India, 20 TCP handshakes each:

| target | p50 | p95 | min |
|---|---|---|---|
| Supabase pooler, Tokyo `ap-northeast-1`, :6543 | 141.0 ms | 180.2 ms | 137.3 ms |
| Supabase direct, Tokyo, :5432 | 140.5 ms | 147.3 ms | 137.5 ms |
| Upstash Redis, Mumbai `ap-south-1`, :6379 | 27.9 ms | 45.6 ms | 24.0 ms |

Regions were established from DNS, not guessed:

- `aws-0-ap-northeast-1.pooler.supabase.com` resolves to `pool-tcp-ap-northeast-1-...elb.ap-northeast-1.amazonaws.com`. **Tokyo.**
- `vocal-quetzal-162058.upstash.io` is a CNAME chain to `global-as1.upstash.io`, whose addresses `13.202.8.139`, `13.204.54.36`, `13.205.216.95`, `16.4.93.191` all fall inside AWS `ap-south-1` prefixes per `ip-ranges.amazonaws.com`. **Mumbai**, an Upstash Global database.

The repo pins no region. `vercel.json` once held `"regions": ["hnd1"]` (added in `5b72d35`), was moved to `apps/student-web/vercel.json` in `4ce6b0f`, and the region key was deliberately dropped; `apps/student-web/src/vercel-config.test.ts` now asserts `config.regions` is `undefined`. teacher-web and admin-panel have no `vercel.json` at all. Vercel's documented default is **iad1, Washington D.C.**

The important correction to the suspect: **moving Vercel to Mumbai would not fix this**, because the database is the thing that is far away. From India the Tokyo database is still 141 ms away. Full analysis and the recommendation are in `PERF_PLAN.md` item P1. Report only, as instructed.

### F3 — The two login rewrites are dead for exactly the users who need them
**CONFIRMED by measurement.**

`apps/teacher-web/next.config.ts` rewrites `/teacher/login` to `/login/teacher` and `/student/login` to `/login/student`. The proxy's `PROTECTED_PREFIXES` at `apps/teacher-web/src/proxy.ts:17` includes `/teacher` and `/student`, and `isProtected` at `:56-58` is a `startsWith` test. The proxy runs before `next.config` rewrites, so a logged-out visitor is redirected away before the rewrite can fire:

```
GET /teacher/login   → 307 /login?next=%2Fteacher%2Flogin → 200
GET /student/login   → 307 /login?next=%2Fstudent%2Flogin → 200
```

Both measured with no cookies. The rewrite only works once you are already logged in, which is when a login page is useless.

One qualification that shapes the fix: **nothing in the repo links to either path.** A grep across `apps`, `packages` and `docs` finds `/teacher/login` and `/student/login` only in the two `source` lines of `next.config.ts` itself. So the rewrites are both broken and unreferenced. Deleting them changes no observable behaviour, because the proxy already sends those URLs to `/login` and would continue to. That makes this a dead-config and correctness item with **no measurable latency benefit**; making the URLs actually serve a login page would require editing the proxy's protected-prefix list, which is auth logic and therefore gated. See `PERF_PLAN.md` P12.

### F4 — An expired access token turns one navigation into three requests, with a database and a Redis hop in the middle
**Hop count CONFIRMED. The success path's middle hop is reasoned from code, not executed.**

Measured, expired access token plus a refresh cookie:

```
GET /teacher/dashboard                → 307
GET /api/auth/silent-refresh?next=... → 307
GET <destination>                     → 200
```

Three requests. `apps/teacher-web/src/app/api/auth/silent-refresh/route.ts` does, in the middle hop: `verifyRefreshToken`, `rotateRefreshSession` in Redis (`:63`), `db.user.findUnique` (`:82`), then two token signings (`:96-99`). So one navigation carries a Redis round trip to Mumbai and a Postgres round trip to Tokyo on top of the three HTTP requests. Access tokens are short-lived, so an active user meets this repeatedly.

A related configuration hazard, **NOT VERIFIED**: `:13` and `:102` build the redirect from `NEXT_PUBLIC_APP_URL`. In this sandbox that sent a teacher-web navigation to port 3002. There is a single `NEXT_PUBLIC_APP_URL` in the shared `.env`, so if teacher-web's Vercel value points at the student-web origin, this redirect leaves the app. Worth checking in the dashboard. The same applies to `apps/teacher-web/src/lib/api.ts:4`, `NEXT_PUBLIC_API_URL || "/api"`: that variable is absent from the committed `.env` files, so it currently falls back to same-origin, but if it is set in Vercel every admin call becomes cross-origin.

### F5 — Discover loads every review row for every teacher on the page
**CONFIRMED. Row counts NOT VERIFIED (no database).**

`apps/student-web/src/app/api/students/discover/route.ts:83-85` includes `reviews: { select: { rating: true } }` with no bound, for up to `query.limit + 1` teachers. The only uses are an average at `:97-100` and a count at `:159`. A teacher with 5,000 reviews moves 5,000 rows across the Tokyo link so one mean can be computed in JavaScript.

`Review` already carries `@@index([teacherId, rating])`, so a `groupBy` with `_avg` and `_count` is index-served. The clone at `apps/teacher-web/src/app/api/students/discover/route.ts` has the same defect.

Two further costs on the same route:

- `apps/student-web/src/lib/discover-query.ts:88` emits `name ILIKE '%term%'`. A leading wildcard cannot use a btree index, so teacher search is a sequential scan. `languageClauses` at `:17-23` does the same on `language`.
- `TeacherProfile` is filtered on `status` and `onboardingComplete` and sorted by `createdAt desc`. The schema has `@@index([status])` and `@@index([language, status])`, so the sort is unsupported and `onboardingComplete` is not indexed.

### F6 — The student dashboard loads every booking the student has ever made
**CONFIRMED. Row counts NOT VERIFIED.**

`apps/student-web/src/app/api/students/dashboard/route.ts:29-57`: `booking.findMany` with no `take`, pulling each booking's `teacher`, every `session`, and the `review`. It is used for three counts (`:87-98`), the next five classes (`:105-110`) and the five most recent (`:113`). The payload grows for the life of the account; the output never exceeds five plus five plus three numbers.

To its credit the route already wraps its three independent reads in `Promise.all` (`:19`), and the comment at `:17-18` shows someone had already spotted the remote-database cost.

### F7 — The recordings route pulls entire `User` rows it never reads
**CONFIRMED.**

`apps/student-web/src/app/api/students/recordings/route.ts:15-32`: `classSession.findMany` with no `take`, and `include: { booking: { include: { teacher: { include: { user: true } } } } }` at `:26`. `include: { user: true }` selects every `User` column, which per the schema means `passwordHash`, `totpSecret`, `backupCodes`, `passwordResetToken` and `emailVerificationToken`.

The response body uses **no field from `user` at all** — only `booking.teacher.name` and `booking.teacher.language`, both on `TeacherProfile`. The join is pure waste, and it drags credential material from Tokyo into function memory for every recording. Identical at `apps/teacher-web/src/app/api/students/recordings/route.ts:26`.

### F8 — teacher-web ships the whole of zod to every authenticated page
**CONFIRMED by measurement.**

Measured first-load payload for the same screen:

| screen | app | first load, gzipped |
|---|---|---|
| student dashboard | student-web `/dashboard` | 208.6 KB |
| student dashboard | teacher-web `/student/dashboard` | **380.3 KB** |

The gap is two chunks present only in teacher-web. One is 277 KB raw and **63.1 KB gzipped**, containing `ZodArray`, `ZodBigInt`, `ZodError` and the rest of zod v4. The other is 362 KB raw and 103.9 KB gzipped.

The import path: `apps/teacher-web/src/components/layout/AppShell.tsx:8` imports `DateOfBirthPrompt`, which at `apps/teacher-web/src/components/auth/DateOfBirthPrompt.tsx:8` imports `@/features/auth/validators/auth`, which imports `zod`. AppShell is used by both the `/student` and `/teacher` layouts, so **every authenticated teacher-web page carries zod** to validate one date of birth in a prompt most users never see. student-web's AppShell does not import it, which is the whole difference.

Also: `apps/student-web/next.config.ts` lists only `lucide-react` in `optimizePackageImports`, while teacher-web lists `lucide-react` and `framer-motion`. framer-motion is statically imported by six student-web files.

### F9 — Two components in the student-web shell fetch the same endpoint on every page load
**CONFIRMED by code. The doubled request is derived, not observed in a browser.**

`apps/student-web/src/components/layout/Sidebar.tsx:36` and `apps/student-web/src/components/layout/TopBar.tsx:51` both `fetch("/api/students/notifications/unread-count")` on mount. AppShell renders both (`:61` and `:69`), so every authenticated page load asks for the same count twice. The Sidebar's own comment at `:30-31` says it "Mirrors the TopBar's unread count", so the sharing was intended, but the initial fetch was never removed.

teacher-web is **not** affected: only its TopBar fetches, choosing the endpoint by role at `:59`.

### F10 — Dead code in the student-web command palette, pointing at a route that does not exist
**CONFIRMED as dead code. It does NOT fire at runtime — my first reading of this was wrong and is corrected here.**

`apps/student-web/src/components/layout/CommandPalette.tsx:72` fetches `/api/teachers/students`, and student-web has no `/api/teachers/*` directory, so that route does not exist in this app. It would 404 if it ran.

It never runs. The fetch is gated on `canSearchStudents` at `:71`, and the only call site, `apps/student-web/src/components/layout/TopBar.tsx:179`, passes `canSearchStudents={false}`. So this is unreachable code copied from teacher-web, not a live wasted request. Impact is bundle size and confusion, not latency. Ranked low accordingly.

### F11 — Background polling with no visibility check
**CONFIRMED by code.**

`apps/student-web/src/app/(authenticated)/dashboard/page.tsx:186` `setInterval(load, 60_000)` with no `document.hidden` guard, so an abandoned tab queries the dashboard every minute indefinitely. Same pattern in `apps/teacher-web/src/app/teacher/dashboard/page.tsx` and `apps/teacher-web/src/app/teacher/schedule/page.tsx`. `apps/student-web/src/components/layout/TopBar.tsx:90` additionally refetches the unread count on every window `focus`.

This is distinct from the chat polling you listed as already fixed, which lives in the chat pages at 10 s and 30 s and was not touched.

### F12 — The shared response cache replays stored headers and cannot be invalidated across instances
**CONFIRMED.**

Beyond being per-instance, `apps/student-web/src/lib/api-cache.ts:64` stores every response header and `:50-53` replays them to the next caller. Nothing on the discover path sets a cookie today, so there is no live leak, but any future `Set-Cookie` on a cached route would be served to another user.

The cache key is `discover:<validated query>:cur=<currency>` (`discover/route.ts:63`). It carries no user id. That is defensible only because the discover body is identical for a given query and currency; it is one refactor away from being wrong.

`invalidateCache("discover:")` is called from the booking route (`apps/student-web/src/app/api/students/teacher/[id]/book/route.ts:69`), but a Map is per-instance, so the invalidation reaches only the instance that served the booking. Every other instance keeps stale data for up to 60 s.

### F13 — Unbounded `findMany` census
**CONFIRMED: 56 sites.**

27 calls pass `take`; 56 do not. By area:

| area | unbounded | note |
|---|---|---|
| `packages/live-classes` | 19 | **off limits, excluded from the plan** |
| `apps/admin-panel` | 16 | whole-table page loads: coupons, invoices, payouts, languages, admin users, settings |
| `apps/teacher-web` | 12 | `students/classes`, `students/dashboard`, `students/recordings`, `teachers/schedule`, `teachers/wallet`, `teacher-service.ts` x3 |
| `apps/student-web` | 8 | `students/classes`, `students/dashboard`, `students/recordings`, `students/complaints`, `students/chat`, `v1/classes`, `v1/me`, `students/teacher/[id]` |
| false positive | 1 | `discover-query.ts:26` is a doc comment |

Correcting the suspect: **the wallet route is already bounded.** `apps/student-web/src/app/api/students/wallet/route.ts:25` passes `take: 50` and parallelises with `Promise.all`.

### F14 — Exchange rates are fetched from a third party through a per-instance cache, on the discover path
**CONFIRMED by code. Call counts in production NOT VERIFIED.**

`packages/currency/src/index.ts:67-95` fetches `api.frankfurter.dev` and caches in a module-level `Map` with a 6 h TTL and a 5 s timeout. There are 16 supported currencies.

On the discover route a non-default price filter calls `convertBudgetRangeToAllCurrencies` (`discover/route.ts:52-58`), which fans out to 16 currencies times 2 bounds, and then `convertMinorUnitsSafe` runs once per teacher inside the `Promise.all` at `:96-106`. On a cold instance, with an empty rate cache, a single filtered discover request can therefore make up to about 32 outbound HTTPS calls to a free third-party service before it answers, each able to wait 5 s. Same class of bug as F2's `api-cache.ts`, on the same request.

---

## 4. Suspect 9, point by point

You listed six possible causes of full reloads. Most are not present, and saying so matters as much as the confirmations.

| your hypothesis | verdict | evidence |
|---|---|---|
| `window.location.href` for internal links | **NOT CONFIRMED** | exactly one assignment repo-wide, `apps/teacher-web/src/lib/auth-client.tsx:131`, and it is a deliberate cross-origin jump to the admin app, where a full navigation is correct |
| `<a href>` for internal links | **NOT CONFIRMED as a real cost** | three in total: `CookieConsent.tsx:24` in both web apps pointing at `/privacy`, and one in the admin panel. Cosmetic |
| `router.refresh()` | **NOT CONFIRMED** | four call sites. Two are admin mutation handlers, two are "try again" buttons in teacher-web error states. All appropriate |
| layouts that remount | **NOT CONFIRMED** | both apps use real route-group layouts. `(authenticated)/layout.tsx` in student-web and `student/layout.tsx` plus `teacher/layout.tsx` in teacher-web each render AppShell once, so it survives client-side navigation within a role |
| full-screen loading states | **CONFIRMED** | `AppShell.tsx:36-47` in both apps. This is F1, and it is the real one |
| refetch on every mount or tab focus | **CONFIRMED** | `TopBar.tsx:90` refetches on window focus; the 60 s dashboard intervals have no visibility guard. F11 |

There are only three `loading.tsx` files across both apps, so Suspense boundaries are largely absent. With pages shaped as static shells that fetch on the client, though, the spinner in AppShell is what users actually see.

---

## 5. Route inventory and payload, from the real build

Turbopack's build output in Next 16.3 prints no size column, so payloads below were measured by fetching each page from `next start` and summing the HTML plus every `<script src>` and `modulepreload` it references, gzipped.

### Static vs dynamic

Both apps prerender almost everything. student-web: 46 pages generated, and every authenticated screen is `○ Static`. teacher-web: 98 pages generated, same picture.

Dynamic (`ƒ`) pages are only: student-web `/live/[sessionId]`, `/teacher/[id]`, `/teacher/[id]/book`; teacher-web `/live/[sessionId]`, `/session/[bookingId]`, `/student/live/[sessionId]`, `/student/teacher/[id]`, `/student/teacher/[id]/book`. Every `/api/*` route is `ƒ`. **Nothing uses ISR.**

This confirms the shape behind F1: a static shell that must hydrate and then fetch before it can show anything. Both builds also succeeded against a dead database, which independently proves no page reads data at build time.

### student-web, first load gzipped

| route | HTML KB | JS files | JS raw KB | first load gz KB |
|---|---|---|---|---|
| `/wallet` | 18.2 | 13 | 932.1 | **271.7** |
| `/chat` | 18.2 | 13 | 769.9 | 245.8 |
| `/recordings` | 18.2 | 13 | 764.3 | 244.4 |
| `/profile` | 17.9 | 12 | 699.1 | 220.2 |
| `/dashboard` | 17.9 | 12 | 657.2 | 208.6 |
| `/discover` | 17.9 | 12 | 653.0 | 207.6 |
| `/classes` | 17.9 | 12 | 653.1 | 207.5 |
| `/notifications` | 18.0 | 12 | 650.7 | 207.1 |
| `/login` | 18.7 | 11 | 604.0 | 192.8 |
| `/` | 14.5 | 9 | 562.8 | 177.6 |

### teacher-web, first load gzipped

| route | HTML KB | first load gz KB |
|---|---|---|
| `/student/dashboard` | 19.7 | **380.3** |
| `/teacher/chat` | 20.7 | 318.5 |
| `/student/chat` | 19.7 | 318.1 |
| `/student/recordings` | 19.7 | 316.7 |
| `/student/profile` | 19.5 | 291.1 |
| `/teacher/schedule` | 20.7 | 289.4 |
| `/` (marketing) | **179.3** | 288.1 |
| `/register/teacher` | 26.4 | 286.6 |
| `/teacher/dashboard` | 20.5 | 283.1 |
| `/student/wallet` | 19.5 | 281.9 |
| `/student/classes` | 19.5 | 278.7 |
| `/teacher/earnings` | 20.5 | 278.7 |
| `/teacher/students` | 20.5 | 278.6 |
| `/student/notifications` | 19.5 | 277.8 |
| `/teacher/wallet` | 20.5 | 275.0 |
| `/login/teacher` | 27.6 | 272.0 |
| `/profile` | 18.0 | 253.7 |
| `/login` | 24.2 | 234.2 |

Every teacher-web route is heavier than its student-web twin. The marketing homepage also sends 179.3 KB of HTML; it is noted and **left alone**, since the homepage is frozen.

---

## 6. Latency and redirect hops, measured locally

40 samples per path, warm local production server, no database involved.

| path | p50 ms | p95 ms | min | max |
|---|---|---|---|---|
| teacher-web `/` public, proxy runs, no JWT | 10.4 | 12.3 | 9.5 | 13.1 |
| teacher-web `/login/teacher` public, proxy, no JWT | 4.9 | 6.8 | 4.3 | 9.7 |
| teacher-web `/teacher/dashboard` proxy + JWT verify | 5.2 | 6.3 | 4.6 | 6.7 |
| teacher-web `/student/dashboard` proxy + JWT verify | 5.3 | 6.9 | 4.6 | 7.0 |
| teacher-web `/favicon.ico` proxy skipped | 2.3 | 3.4 | 1.8 | 3.7 |
| student-web `/` proxy not matched for pages | 3.3 | 4.4 | 2.7 | 5.0 |
| student-web `/dashboard` proxy not matched | 3.3 | 4.4 | 2.7 | 8.1 |

Proxy JWT work in isolation, 300 iterations:

| operation | p50 | p95 |
|---|---|---|
| `importSPKI` alone, uncached as today | 0.059 ms | 0.119 ms |
| `jwtVerify` with a cached key | 0.133 ms | 0.214 ms |
| `importSPKI` + `jwtVerify`, what `proxy.ts` does | 0.253 ms | 0.460 ms |

This is what retires suspect 4 as a performance item. Caching the key saves about 0.06 ms per protected request. It is still worth doing as hygiene, but it is not why anything feels slow. Note this is Node's WebCrypto on Windows; Vercel's Edge runtime was not measured.

### Redirect hop counts

| navigation | cookies | requests | chain |
|---|---|---|---|
| teacher-web `/` | none | 1 | 200 |
| teacher-web `/login`, `/login/teacher` | none | 1 | 200 |
| teacher-web `/teacher/dashboard` | none | 2 | 307 to `/login?next=…` |
| teacher-web `/profile` | none | 2 | 307 to `/login?next=…` |
| teacher-web `/teacher/login` | none | **2** | 307 to `/login?next=%2Fteacher%2Flogin`. **rewrite never fires**, F3 |
| teacher-web `/student/login` | none | **2** | 307 to `/login?next=%2Fstudent%2Flogin`. **rewrite never fires**, F3 |
| teacher-web `/teacher/dashboard` | valid teacher | 1 | 200 |
| teacher-web `/student/dashboard` | valid teacher | 2 | 307 to `/teacher/dashboard`, role bounce |
| teacher-web `/teacher/dashboard` | **expired** access + refresh | **3** | 307 to silent-refresh, 307 to destination. F4 |
| teacher-web `/teacher/dashboard` | refresh only | **3** | same |
| teacher-web `/teacher/dashboard/` | none | **3** | 308 trailing slash, 307 auth, 200 |
| student-web `/dashboard`, `/discover`, `/wallet` | none | 1 | **200, no edge auth at all** |

Two things stand out. The trailing-slash 308 stacks on top of the auth redirect, so any internal link written with a trailing slash costs an extra hop. And student-web's proxy matcher is `/api/:path*` only (`apps/student-web/src/proxy.ts:120`), so its pages have no edge authentication: an unauthenticated visitor gets a full 200, downloads 208 KB of JS, calls `/api/auth/me`, and is then bounced client-side by AppShell's `router.replace("/login")`.

---

## 7. Where the infrastructure actually is

| component | location | how established |
|---|---|---|
| Supabase Postgres | **AWS `ap-northeast-1`, Tokyo** | DNS CNAME to `…elb.ap-northeast-1.amazonaws.com` |
| Upstash Redis | **AWS `ap-south-1`, Mumbai**, Global database | CNAME chain to `global-as1.upstash.io`; all four IPs inside `ap-south-1` per AWS `ip-ranges.json` |
| Vercel | **unpinned, so the project default, documented as `iad1`, Washington D.C.** | no `regions` key in the repo; dashboard NOT VERIFIED |
| Users | India | your brief |

Recommendation is in `PERF_PLAN.md` P1. Report only; nothing in a dashboard was touched.

---

## 8. The top ten user paths

Request counts are **derived from reading the client components**, since no browser was available. "Nav" is the measured hop count from section 6.

| path | render | nav requests | API calls after hydrate | notes |
|---|---|---|---|---|
| Landing, student-web `/` | static | 1 | `/api/auth/me` | 177.6 KB gz, lightest page in either app |
| Landing, teacher-web `/` | static | 1 | `/api/auth/me` | 179.3 KB of HTML; frozen, untouched |
| Login | static | 1 | `/api/auth/me`, then `/api/auth/login` | `/teacher/login` and `/student/login` are broken entry points, F3 |
| Student dashboard | static shell | 1, or 3 on an expired token | `/api/auth/me` then `/api/students/dashboard`, plus 2 unread-count | serial waterfall F1; duplicate count F9; unbounded bookings F6; polls every 60 s F11 |
| Discover | static shell | 1 | `/api/auth/me` then `/api/students/discover`, plus 2 unread-count | review scan F5, ILIKE scan F5, FX fan-out F14, stale shared cache F12 |
| Teacher profile `/teacher/[id]` | **dynamic** | 1 | `/api/students/teacher/[id]` | one of the few server-rendered pages |
| Booking `/teacher/[id]/book` | **dynamic** | 1 | 2 on load: teacher and wallet | whether those two are parallel was not checked |
| Chat | static shell | 1 | `/api/students/chat` then a per-thread fetch | polling already fixed, untouched. 245.8 KB gz |
| Classes list | static shell | 1 | `/api/students/classes?filter=…` | unbounded bookings |
| Wallet | static shell | 1 | `/api/students/wallet` | route already bounded and parallel. Heaviest student-web page at 271.7 KB gz |
| Teacher dashboard | static shell | 1, or 3 expired | `/api/auth/me` then `/api/teachers/dashboard` | 283.1 KB gz, polls on an interval |

---

## 9. Index gaps

The schema is in better shape than the suspect assumed. Already correct for their hot queries: `Notification` `@@index([userId, isRead])` and `@@index([userId, createdAt(sort: Desc)])`; `CoinTransaction` `@@index([userId, createdAt])`; `ChatMessage` three composites including both directions with `createdAt`; `ClassSession` `@@index([bookingId])`, `@@index([scheduledStart])`, `@@index([status, scheduledStart])`; `Review` `@@index([teacherId, rating])`, which is exactly what the F5 aggregate needs.

Gaps, all **NOT VERIFIED** without `EXPLAIN`:

| model | query | present | missing |
|---|---|---|---|
| `TeacherProfile` | discover: `status` plus `onboardingComplete`, order `createdAt desc` | `[status]`, `[language, status]` | nothing supports the sort; `onboardingComplete` unindexed |
| `TeacherProfile` | `name ILIKE '%term%'` | none | no trigram index; a leading wildcard cannot use btree regardless |
| `Booking` | `where studentId` order `createdAt desc` | `[studentId, status]`, `[teacherId, status]`, `[status]` | `[studentId, createdAt]`, `[teacherId, createdAt]` for filter-plus-sort |

Index changes are migration files only, never applied, per your rules.

---

## 10. Baseline for the four checks

Captured on `fix/perf` before any change, so Step 3 has something to compare against.

| check | result |
|---|---|
| `npm run typecheck` | **0 errors** |
| `npm run lint` | **0 errors, 0 warnings** |
| `npm test` | **766 passed, 0 failed** (12+39+38+1+2+3+8+3+3+4 = 113 files) |
| `npm run test:payments` | **217 passed, 0 failed, 2 skipped** (25 files) |

Worth noting against your rules: the baseline is **fully green**. The "known #12 failure" you allowed for was fixed in `636bd2a`, so there is no longer any permitted failure. In Step 3 any failure at all is a regression and the change gets undone.

---

## 11. Reproducing any of this

Scripts live in the session scratchpad, outside the repo:

`C:\Users\PRIYAN~1\AppData\Local\Temp\claude\c--Users-PRIYANSHU-Language-metrics\da950a1d-93d3-4e90-9eaf-063ea380a85e\scratchpad\perf\`

`sandbox-env.sh` the dummy environment; `build.log` both builds; `jsweight.mjs` and `jsweight2.mjs` payloads; `chunks.mjs` the per-chunk breakdown; `latency.mjs` percentiles; `jose-bench.mjs` the JWT microbenchmark; `rtt.mjs` the TCP handshake timing; `trace.sh` the redirect tracer; `findmany-census.mjs` and `fetch-census.mjs` the censuses; `mint.mjs` with `sandbox-keys.json` the throwaway tokens.

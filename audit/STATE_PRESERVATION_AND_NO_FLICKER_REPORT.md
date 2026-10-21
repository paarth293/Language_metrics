# State Preservation and No-Flicker Navigation

Branch `fix/state-preservation-no-flicker`, based on `origin/main` at `2ad21a8`.
58 files changed, one commit per file. For the exact range, see
`git diff --stat origin/main..fix/state-preservation-no-flicker`.

**Read this first:** every number below comes from a scripted component-level
harness run in jsdom, not from a browser. There is no authenticated Playwright
run in this report, and no production or staging measurement. Section 8 says
exactly why, and what that leaves unverified.

---

## 1. What was wrong

The symptom — "returning to a tab or revisiting a page reloads everything, data
disappears, loading screens cover the interface" — had four independent causes.
Three are in the two web apps; one is in the admin panel.

### 1.1 Page data lived in component state

Every authenticated page in `student-web` and `teacher-web` held its API
response in `useState` and fetched it in a `useEffect`. React unmounts a page's
component when you navigate to a sibling route, so that state was destroyed on
every navigation. Coming back re-ran the fetch from zero and re-rendered the
page's full-screen skeleton over data that had been on screen a second earlier.

The canonical shape, from the pre-fix teacher dashboard:

```tsx
const [data, setData] = useState<DashboardData | null>(null);
// ...
if (!data || !derived) {
  return <div aria-busy="true" aria-label="Loading dashboard"> /* skeleton */ </div>;
}
```

36 of the 94 page files in the three apps fetched this way, and 32 of them
gated their whole body on a loading flag.

### 1.2 Tab resumes refetched without checking freshness

Nine files had a `visibilitychange` handler, and every one refetched
unconditionally on becoming visible:

```tsx
const onVisibility = () => {
  if (document.visibilityState === "visible" && !cancelled) {
    clearTimeout(timer);
    void tick();            // always a request, however fresh the data was
  }
};
```

Switching to another tab and back therefore re-issued the page's requests even
if the data was two seconds old. The two `TopBar` components added a `focus`
listener of their own, and the teacher one re-ran its whole effect — including
its initial fetch — whenever the `user` object identity changed, which a
session refresh does on every route change.

Teacher discovery ("Find Teacher") had no debounce: `searchQuery` was a
dependency of the fetch callback, so typing `spanish` fired seven overlapping
requests.

### 1.3 The loading boundaries sat above the app shell

`teacher-web` had `app/loading.tsx` (a full-screen spinner) and
`app/teacher/loading.tsx`, but no `app/student/loading.tsx`. `student-web` had
only `app/loading.tsx`. A `loading.tsx` is a Suspense boundary around the
children of the layout it sits beside, so with no closer boundary a suspending
student route fell back to the root one — which is *above* `AppShell`. The
sidebar, header and breadcrumb were all replaced on the way to the next page.

This only bites when a navigation actually suspends. After the build, most
authenticated routes in both apps are statically prerendered (`○`), so a
completed prefetch makes them instant. The routes that are server-rendered on
demand (`ƒ`) are the ones that hit this: in `teacher-web`
`/student/teacher/[id]`, `/student/teacher/[id]/book`,
`/student/live/[sessionId]`, `/session/[bookingId]`, `/live/[sessionId]`; in
`student-web` `/teacher/[id]`, `/teacher/[id]/book`, `/live/[sessionId]`.
Those are the main paths out of discovery, so the effect was visible in the
most-used student flow. It also appeared on any route whose prefetch had not
finished.

### 1.4 The admin panel threw its router cache away on every navigation

Every page under `apps/admin-panel/src/app/(dashboard)/` is
`export const dynamic = 'force-dynamic'` and a server component. Next's default
`experimental.staleTimes.dynamic` is `0` — confirmed in the installed
`next@16.3.8`, `node_modules/next/dist/server/config-shared.js:260`:

```js
staleTimes: { dynamic: 0, static: 300 },
```

A payload for a dynamic route is discarded the moment it is used, so every
client-side navigation — Back and Forward included — re-requested the route
from the server and showed `(dashboard)/loading.tsx` again. That boundary
rendered a *dashboard-shaped* skeleton (a title, four metric tiles, a 2:1 panel
split) for every destination, so navigating to Teachers or Audit Logs flashed
the shape of a page the admin had not asked for.

### 1.5 Smaller contributors, each confirmed in code

| Finding | Where |
|---|---|
| `window.location.reload()` as a retry — tore down the shell and every other cached page to recover from one failed request | `student-web .../wallet/page.tsx`, `teacher-web .../student/dashboard/page.tsx`, `.../teacher/students/page.tsx` |
| `router.refresh()` as a retry — re-ran the whole route tree | `teacher-web .../student/notifications/page.tsx`, `.../student/wallet/page.tsx` |
| Page-root entrance animations (`animate-in fade-in …`) replayed on every navigation back to the page | 14 page files |
| A booking page awaited the teacher profile before starting the wallet request | both `teacher/[id]/book` pages |
| Earnings and wallet shared one loading flag, so either failing took the page down | `teacher-web .../teacher/earnings/page.tsx` |
| One `error` state carried both load and submit failures, so dismissing a submit error hid a failed load | both `support` pages |
| Onboarding pushed `/dashboard`, which is not a route in `teacher-web` — a 404 and a full document load | `teacher-web .../student/onboarding/page.tsx` |
| A bare `setInterval` polled LiveKit's rate-limited REST API every 15s in hidden background tabs | `admin-panel .../live/LiveOpsClient.tsx` |

---

## 2. Route inventory

94 page files. "Client fetch" means the page requested its own data from the
browser and so was subject to §1.1 and §1.2.

### student-web — 18 pages, 12 with client fetches

| Route | Client fetch | Changed |
|---|---|---|
| `/dashboard` | yes | cache, poll, stale banner |
| `/discover` | yes | cache, debounce, sticky filters |
| `/classes` | yes | cache per tab, sticky tab |
| `/recordings` | yes | cache, sticky filter + search |
| `/chat` | yes | cache-seeded threads and messages, sticky conversation |
| `/wallet` | yes | cache (10s), retry without a document reload |
| `/notifications` | yes | cache (15s) + poll, optimistic writes via cache |
| `/profile` | yes | cache, seeded once, save invalidates |
| `/support` | yes | cache, load and submit errors separated |
| `/teacher/[id]` | yes | cache (120s), shared with booking |
| `/teacher/[id]/book` | yes | two parallel cached keys |
| `/onboarding` | yes (PUT) | invalidates student keys |
| `/live/[sessionId]` | — | unchanged |
| `/faq`, `/privacy`, `/terms` | — | unchanged |
| `/login`, `/` | — | unchanged |
| *(new)* `(authenticated)/loading.tsx` | — | boundary moved inside the shell |

### teacher-web — 48 pages, 24 with client fetches

| Route | Client fetch | Changed |
|---|---|---|
| `/teacher/dashboard` | yes | cache, day-stable key, poll, stale banner |
| `/teacher/schedule` | yes | cache per week, sticky week + view |
| `/teacher/sessions` | yes | cache, sticky tab + search |
| `/teacher/students` | yes | cache, sticky level filter, retry without reload |
| `/teacher/chat` | yes | cache-seeded threads and messages, sticky conversation |
| `/teacher/earnings` | yes | two independent keys, sticky tab |
| `/teacher/notifications` | yes | cache (15s) + poll, optimistic writes via cache |
| `/teacher/profile` | yes | cache, seeded once, save invalidates |
| `/teacher/wallet` | — | unchanged (static page) |
| `/student/dashboard` | yes | cache, poll, retry without reload |
| `/student/discover` | yes | cache, debounce, sticky filters |
| `/student/classes` | yes | cache per tab, sticky tab |
| `/student/recordings` | yes | cache, sticky filter + search |
| `/student/chat` | yes | cache-seeded threads and messages |
| `/student/wallet` | yes | cache (10s), retry without `router.refresh()` |
| `/student/notifications` | yes | cache (15s) + poll |
| `/student/profile` | yes | cache, seeded once, save invalidates |
| `/student/support` | yes | cache, load and submit errors separated |
| `/student/teacher/[id]` | yes | cache (120s) |
| `/student/teacher/[id]/book` | yes | two parallel cached keys |
| `/student/onboarding` | yes (PUT) | invalidation + redirect to a route that exists |
| `/admin/dashboard` | — | unchanged |
| `/student/faq`, `/student/privacy`, `/student/terms` | — | unchanged |
| `/live/[sessionId]`, `/student/live/[sessionId]`, `/session/[bookingId]` | — | unchanged |
| 17 public / marketing / auth routes | — | **untouched** (homepage is frozen) |
| *(new)* `app/student/loading.tsx` | — | boundary moved inside the shell |

### admin-panel — 28 pages, 0 with client fetches

Every page is a server component reading the database directly, so §1.1 and
§1.2 do not apply. One client island, `(dashboard)/live/LiveOpsClient.tsx`,
polls. The changes are the router-cache window, the loading boundary, and that
poll — the first two apply to all 27 routes under `(dashboard)` plus `/login`.

---

## 3. What changed

### 3.1 A shared client cache in `@repo/ui`

| File | Purpose |
|---|---|
| `resource-cache.ts` | Module-level store outside the React tree. Survives unmounts. De-duplicates concurrent requests per key. Records when each key last succeeded and last failed. Scoped to a user id. |
| `useResource.ts` | Stale-while-revalidate hook. `isLoading` is true only when there is nothing to render. Tab resumes consult recorded freshness. Polls pause while hidden. |
| `useStickyState.ts` | `useState` that outlives a route change, in the same store, so it is wiped by the same logout handling. |
| `useDebouncedValue.ts` | Settles a search term before it becomes part of a cache key. |
| `StaleDataNotice.tsx` | Non-blocking banner for a refresh that failed over data still on screen. |

Three design decisions worth stating:

- **No new dependency.** TanStack Query and SWR were both absent, and nothing
  in the repo had a competing client cache (`lib/api-cache.ts` is the
  *server*-side Redis cache-aside for API routes, unrelated). A ~200-line store
  plus a hook was smaller than migrating 36 pages onto a library.
- **Keys are request URLs; isolation is the owner scope.** Keys are not
  per-user. `setCacheOwner(id)` is called from both `AuthProvider`s with
  whatever `/api/auth/me` resolves, and any change to that id wipes the store.
  A response that lands *after* the owner changed is discarded, not written.
- **The first owner resolution is binding, not a switch.** `undefined`
  ("hydrating") is deliberately distinct from `null` ("signed out"), so a page
  reload does not throw away data the same user just loaded.

### 3.2 Caching policy, per data category

All client-side, in the browser tab, keyed by URL, scoped to the signed-in user
id, and discarded on logout or account change. "Poll" runs only while the tab
is visible.

| Category | Key | Fresh for | Poll | Invalidated by |
|---|---|---|---|---|
| Teacher dashboard | `/api/teachers/dashboard?<week+month>` | 30s | 60s | profile save |
| Student dashboard | `/api/students/dashboard` | 30s | 60s | profile save, booking, onboarding |
| Teacher schedule | `/api/teachers/schedule?from&to` — one key per week | 30s | 60s | working-hours save |
| Sessions / classes | `/api/teachers/schedule`, `/api/students/classes?filter=` — one key per tab | 30s | — | cancel, reschedule |
| Teacher discovery | `/api/students/discover?<filters>` — one key per filter set | 60s | — | — |
| Teacher public profile | `/api/students/teacher/<id>` | 120s | — | that teacher's profile save |
| Recordings | `/api/students/recordings` | 60s | — | unlock |
| Notifications list | `/api/{students,teachers}/notifications` | 15s | 60s | read-marking (optimistic write) |
| Unread count | `/api/*/notifications/unread-count` | 15s | — | `notifications-updated` event |
| Wallet / balance | `/api/students/wallet`, `/api/teachers/wallet` | 10s | — | top-up, unlock, booking |
| Earnings | `/api/teachers/earnings` | 30s | — | — |
| Own profile (editable) | `/api/{students,teachers}/profile` | 60s, **no focus revalidation** | — | own save |
| Support tickets | `/api/students/complaints` | 30s | — | ticket submit |
| Chat threads | `/api/*/chat` | mirrored into the cache; page keeps its own poll | 30s | — |
| Chat messages | `/api/*/chat/<id>` | mirrored into the cache; page keeps its idle backoff | 10–30s | — |
| Admin lists / analytics | server components; Next router cache | 15s | — | `router.refresh()` after a mutation |
| Reference data (currencies, languages) | bundled constants, no request | — | — | — |

Editable profile forms are the one place focus revalidation is **off** and the
fields are seeded exactly once per mount. A background payload landing mid-edit
would reseed the inputs and silently discard whatever the user had typed. This
is a deliberate trade: the form can be up to 60s behind a change made on
another device.

Nothing user-specific was added to a shared server cache. `withCache` in
`lib/api-cache.ts` is untouched.

### 3.3 Router cache and loading boundaries

- `experimental.staleTimes` set in all three apps: `dynamic: 30` in the two web
  apps, `dynamic: 15` in the admin panel. The web apps' pages are client
  components whose data comes from API routes that re-authenticate on every
  call, so a reused payload cannot expose more than a fresh one. Admin pages
  are server components that carry data *inside* the payload, so the shorter
  window also bounds how long an admin whose access was just revoked could
  re-read a page they had already opened.
- New `app/student/loading.tsx` (teacher-web) and
  `app/(authenticated)/loading.tsx` (student-web), so suspending routes in
  those sections keep the sidebar and header.
- `admin-panel (dashboard)/loading.tsx` rewritten shape-neutral.

### 3.4 Request hygiene

- Focus and poll revalidation both consult recorded freshness, so a tab resume
  no longer fans out one request per polled key.
- A poll tick whose key was refreshed in the meantime re-arms instead of
  refetching.
- Search terms are debounced at 300ms before entering a key.
- Both `TopBar`s stopped keying on the whole `user` object.
- `LiveOpsClient` pauses while hidden and refreshes once on return, timed from
  its last load so the return is not a burst.
- The booking pages fetch teacher and wallet in parallel.

---

## 4. Measurements

### 4.1 Method

`audit/state-preservation/navigation-requests.test.tsx` and
`navigation-requests.student-web.test.tsx` render a real page component with
`fetch` stubbed and a request log, then script four interactions:

1. cold first visit with nothing cached;
2. unmount and re-render — what a sibling-route navigation and return does to
   a page component;
3. tab hidden 5s, then visible;
4. tab hidden 300s, then visible.

Each run records requests per interaction and whether the revisit's first paint
was covered by a loader. The same file runs against the pre-fix tree: the
baseline numbers below were produced by checking the page files out from
`origin/main`, running the identical script, and restoring them. Timers and
`Date` are faked, so the intervals are exact.

### 4.2 Results

`teacher-web`:

| Route | Loader on revisit | Requests on revisit | Requests, 5s resume | Requests, 300s resume |
|---|---|---|---|---|
| `/teacher/dashboard` | **yes → no** | **1 → 0** | **1 → 0** | 1 → 1 |
| `/teacher/students` | no\* → no | **1 → 0** | 0 → 0 | 0 → **1** |
| `/teacher/sessions` | **yes → no** | **1 → 0** | 0 → 0 | 0 → **1** |

`student-web`:

| Route | Loader on revisit | Requests on revisit | Requests, 5s resume | Requests, 300s resume |
|---|---|---|---|---|
| `/recordings` | **yes → no** | **1 → 0** | 0 → 0 | 0 → **1** |
| `/classes` | no\* → no | **1 → 0** | 0 → 0 | 0 → **1** |

\* The harness decides "covered by a loader" by looking for `aria-busy` or a
spinner *and* the absence of a content marker. `/teacher/students` and
`/classes` keep their page heading visible and swap only the list region, so
the marker is still present and the harness reports no coverage even though the
list itself did render a skeleton. Treat those two cells as "not measured", not
as "was already fine".

Reading the 300s column honestly: three routes went from **0 → 1**. Before the
change those pages never refreshed at all once loaded — a list could sit
arbitrarily stale until something remounted it. They now revalidate once when
the data is genuinely older than its freshness window, in the background, over
content that stays on screen. That is a deliberate trade of "never refresh" for
"one request when stale", not a regression in request volume per unit of
staleness.

### 4.3 What these numbers do and do not say

They measure the component-level behaviour that caused the symptom: whether a
revisit refetches, whether it shows a loader, and whether a tab resume issues
requests. They say nothing about wall-clock load time, LCP, CLS, TTFB, or
browser Back/Forward, because no browser was involved.

---

## 5. Tests

| Suite | Result |
|---|---|
| `packages/ui` | 44 passed, 8 files |
| `apps/teacher-web` | 333 passed, 47 files |
| `apps/student-web` | 249 passed, 44 files |
| `apps/admin-panel` | 60 passed, 12 files |
| Measurement harness | 5 passed |

New coverage, mapped to the acceptance list in the brief:

| Requirement | Test |
|---|---|
| Tab switching does not reload the app | `useResource.test.tsx` "does not refetch when the tab becomes visible and the data is fresh"; `page.polling.test.tsx` "does not refetch on a tab resume while the data is still fresh" |
| Loaded content stays visible during revalidation | `useResource.test.tsx` "revalidates a stale revisit in the background, keeping the old data visible" |
| First visit without cache shows a loading state | `useResource.test.tsx` "shows a loading state only on a first visit with nothing cached" |
| Fresh data appears after a successful refresh | same test — asserts `first` → `second` |
| Stale data is handled after a failed refresh | `useResource.test.tsx` "keeps data visible and flags it stale when a refresh fails"; `resource-cache.test.ts` "keeps the previous payload visible when a refresh fails" |
| Logout clears protected data | `auth-client.cache-scope.test.tsx` "logging out discards every cached response" |
| Account switching cannot reveal the previous user's data | `auth-client.cache-scope.test.tsx` "a second account cannot read the first account's cached data"; `resource-cache.test.ts` "discards a response that arrives after the user changed" |
| Student / teacher data stay isolated | `cache-isolation.test.ts` — both directions, plus an in-flight response after a logout wipe |
| Polling and focus handlers do not duplicate requests | `useResource.test.tsx` "serves two components from one request", "polls only while the tab is visible", "stops polling and detaches listeners after unmount" |
| Revisit paints cached data, not a skeleton | `page.polling.test.tsx` "paints cached data instead of the skeleton when the page is revisited" |
| Filters survive a navigation but not a session change | `useStickyState.test.tsx` — all five cases |

Lint (`--max-warnings 0`) and `tsc --noEmit` are clean in `packages/ui` and all
three apps. `next build` succeeds for all three.

---

## 6. Security and data correctness

- **Nothing new is persisted.** The cache is in-memory for the life of the tab.
  No `localStorage`, no `sessionStorage`, no IndexedDB, no cookies.
- **One identity at a time.** `setCacheOwner` is driven solely by
  `/api/auth/me`. Any change wipes the store, and an in-flight response for the
  previous owner is dropped instead of written. Six tests cover this.
- **Authorisation is unchanged.** No change to `proxy.ts`, `requireAdmin()`,
  token rotation, `fetchWithRefresh`, or any API route. Expired sessions and
  revoked permissions are enforced exactly where they were before. The support
  pages keep `fetchWithRefresh` as their fetcher, so an expired access token is
  still rotated once and retried.
- **Stale content never hides an auth failure.** A 401 is a failed fetch: the
  key keeps no new data and the page shows its error path. `AppShell` still
  redirects an unauthenticated or wrong-role user.
- **The router-cache window is the one place to look twice.** Within it, a
  navigation back to an already-visited page is served from memory and the
  server is not consulted — so neither is `proxy.ts` or `requireAdmin()`. That
  is inherent to Next's client router cache and already applies to prefetching
  today; what changed is that the window is 15s (admin) or 30s (web) instead of
  0. It only covers pages this session already rendered. Any page not already
  cached, every API call, and every `router.refresh()` after a mutation all
  re-check. Access tokens last 15 minutes, so the window is a small fraction of
  a session. **If 15s is judged too long for the admin panel, set
  `experimental.staleTimes.dynamic` back to `0` there** — admin keeps the
  loading-boundary and polling fixes and loses only the instant Back/Forward.
- **No sensitive decision is cached.** Payment authorisation, booking
  eligibility and wallet debits are all server-side. The wallet's 10s window is
  a *display* balance, and the booking endpoint re-checks the balance itself.

---

## 7. Deliberately not changed

- **The marketing homepage and all public routes in `teacher-web`.** Frozen.
- **Chat message paging and scroll anchoring.** The chat pages' versioned
  requests, in-flight guards, idle backoff, older-message prepend and scroll
  preservation are intricate and already correct. Only where the first paint
  comes from was changed. Restructuring the merge logic onto the hook was not
  worth the regression risk.
- **`/live/[sessionId]`, `/session/[bookingId]` and the classroom package.** A
  live class is a long-lived connection with its own lifecycle; caching has
  nothing to offer it, and a mistake there drops people out of lessons.
- **The duplication between `student-web` and `teacher-web/app/student/*`.**
  Two near-copies of the same student app exist. Both were fixed, in parallel,
  which doubled the work. Consolidating them is separate work and is the single
  biggest maintenance win available in this area.
- **Server-side caching.** `withCache` and the Redis cache-aside are untouched.
  Redis does not preserve browser UI state and was never the cause here.

---

## 8. Limitations — what is not verified

1. **No authenticated browser run.** The brief asked for Playwright
   reproduction against the three production domains with test accounts. There
   are no test-account credentials in the repo, in `.env`, or in the existing
   e2e specs (`tests/e2e/*` only exercise unauthenticated login pages). The only
   database URL available points at the production Supabase instance, so no
   login, navigation or flow was run against it — logging in would create real
   sessions, and the brief forbids touching production data. **To close this
   gap I need either staging credentials or a local database with seeded test
   accounts.** With those, the four scripted interactions in §4.1 translate
   directly into a Playwright spec per route.
2. **No LCP, CLS, TTFB or wall-clock numbers.** Those need a browser against a
   running authenticated app. The existing `audit/PERF_BASELINE.md` and
   `audit/perf-results.json` are from earlier work on different routes and are
   not a baseline for this change.
3. **Back/Forward is not empirically verified.** The fix is the `staleTimes`
   config. Its default of `dynamic: 0` was confirmed by reading the installed
   `next@16.3.8` config schema and defaults, and the mechanism is documented
   Next behaviour — but no browser pressed Back.
4. **Two "loader on revisit" cells are not measured**, for the reason in §4.2.
5. **The admin panel has no component-level harness.** Its pages are server
   components, so the jsdom approach does not reach them. Its three changes are
   config, a boundary file, and a poll — reviewable by reading, none measured.
6. **Remount counts were not instrumented.** The harness counts requests, not
   React commits. The structural claim — `AppShell` is mounted by the section
   layouts, so it is retained across sibling routes — was verified by reading
   `app/teacher/layout.tsx`, `app/student/layout.tsx` and
   `app/(authenticated)/layout.tsx`, not by counting mounts.
7. **Pages that fetch nothing** were not touched and are not covered by any of
   this.

---

## 9. Reproducing the measurements

```bash
# after
cd apps/teacher-web
npx vitest run --dir ../../audit/state-preservation --config vitest.config.mts --reporter=verbose
cd ../student-web
npx vitest run --dir ../../audit/state-preservation --config vitest.config.mts --reporter=verbose navigation-requests.student-web

# before — restore immediately afterwards
cd ../..
git checkout origin/main -- \
  apps/teacher-web/src/app/teacher/dashboard/page.tsx \
  apps/teacher-web/src/app/teacher/students/page.tsx \
  apps/teacher-web/src/app/teacher/sessions/page.tsx
(cd apps/teacher-web && npx vitest run --dir ../../audit/state-preservation --config vitest.config.mts --reporter=verbose)
git checkout HEAD -- \
  apps/teacher-web/src/app/teacher/dashboard/page.tsx \
  apps/teacher-web/src/app/teacher/students/page.tsx \
  apps/teacher-web/src/app/teacher/sessions/page.tsx
```

Each test prints one JSON line of counters.

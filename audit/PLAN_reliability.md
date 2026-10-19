# Plan: reliability batch (#7, #8, #10, #20, #31, code part of #21)

Source of truth: `audit/PRODUCTION_READINESS.md`. Branch `fix/reliability`, cut from `fix/chat-security` @ `6d0dca0`. Date 2026-10-19. **Status: waiting for "go". #10 needs its own separate "go".**

Branch checks, done before cutting the branch:
- registration-code Redis fallback + #39 prune: `23196e8`, in history;
- #39 test: `65bcf63`;
- audit files: `3a37b6b`.

Working tree was clean.

Per issue: proof test first (real failure) → fix → real pass → `typecheck`, `lint`, `npm test`, `test:payments`. Anything other than the #12 failure + 2 skips → I undo that issue and tell you. Progress goes in `audit/PROGRESS.md`. Not pushed.

---

## Answers I need before "go"

1. **#8 commit size.** #8 is too big for one small commit: Sentry in 3 apps, a logger, ~110 `console.*` calls in ~70 payment/auth/webhook/cron files, alerts, 3 error pages, 1 health route. I propose **6 commits for #8 (8a–8f below)**, each passing the full gate. OK?
2. **#8 request ID.** Your premise isn't quite what the code does:
   - Only **teacher-web's** proxy sets `X-Request-ID`, and only on **responses**: a new random UUID at three separate places (`apps/teacher-web/src/proxy.ts:136,143,201`), never passed to the handler.
   - student-web's proxy only runs for `/api/v1/*` (`apps/student-web/src/proxy.ts:87`).
   - admin-panel's proxy skips `/api` entirely (`apps/admin-panel/src/proxy.ts:90`).

   So payment, webhook and cron handlers can't see any ID today. **Proposal:** the logger takes the ID from `x-request-id` (if a caller or proxy sent one), else Vercel's `x-vercel-id`, else a new UUID. Where a proxy already runs (teacher-web), it puts **one** ID on both the forwarded request and the response. I would **not** widen the student-web/admin matchers; that changes which requests run CSRF/auth code. OK?
3. **#8 Sentry** means a new dependency: `@sentry/nextjs@11.8.0` (peer `next ^16`, we have 16.3.8; the registry is reachable). I'd install it in the three web apps.
   - No source-map upload: that needs `SENTRY_AUTH_TOKEN`, so stack traces stay minified. Your call to add later.
   - `withSentryConfig` is **not** used, so `next.config` doesn't change. Init only in `instrumentation.ts` / `instrumentation-client.ts` when `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` is set.
4. **#10 scope: something new, not in the audit.** `packages/live-classes/src/recording-payments.ts:58-59` has the **same order** as #10: Cashfree first, then the DB row. PAYMENT_AUDIT.md:140 rated it PASS ("orphan Cashfree order … harmless"), and #10 names only `coin-payments.ts`. Fix it in the same way, or leave it?
5. **#10 FAILED rows and the reconciler.** The sweep scans `CREATED` **and** `FAILED` rows aged 10 min–72 h (`payment-reconciliation.ts:54-62`). A row marked FAILED because Cashfree never created the order would 404 at Cashfree. `fetchSuccessfulPayment` turns that into a 502, so it would show up as `reconciliation_failed` (an alert) **every 10 minutes for 72 h**. **Proposal:** in the sweep, a Cashfree "order not found" (404) on a row marks it `EXPIRED` quietly. That uses the existing transition `FAILED → EXPIRED`. The proof test covers it. OK? (If I also fix the recording flow, its "reuse an open order" lookup at `recording-payments.ts:41-55` needs the same 404 handling.)
6. **#20 lock type.** The production DB is most likely reached through Supabase's pooler (`.env.example:11` says `DIRECT_URL` is for "Supabase's connection pooler"; NOT VERIFIED).
   - With a transaction-mode pooler, a **session** `pg_try_advisory_lock` and its `pg_advisory_unlock` can run on different server connections. The unlock then fails and the lock leaks until that connection is recycled, which **blocks every later run**.
   - **Proposal:** `pg_try_advisory_xact_lock` taken inside one Prisma transaction that stays open for the sweep (timeout = time budget + margin). It's released automatically at commit/rollback, or if the connection dies. It works the same pooled or direct. Cost: one connection held for the duration of the run.
   - This is the transaction-scoped variant of what you asked for. OK?
7. **#20 + GitHub secret.** The workflow's own example `APP_URL` is **teacher-web** (`.github/workflows/reconcile-payments.yml:14`, same in `reconcile-sessions.yml:14`). If the repo secret really points at teacher-web, making those routes return 410 makes `curl --fail` fail every run, and **payment reconciliation stops**. I can't see the secret.
   - **Proposal:** teacher-web returns 410 with `{ moved_to: "student-web" }`, and you **change `APP_URL` to the student-web origin before deploying this**. I'll also update the comment.
   - Alternatively, teacher-web could keep working until you confirm the secret, and 410 could follow later. Your call.
8. **#21 region.** The root `vercel.json` also has `"regions": ["hnd1"]`. If Vercel isn't reading the root file (that's the #21 finding), the region isn't being applied either. Moving the file into `apps/student-web/` would **start** pinning student-web to Tokyo, which changes DB latency (DB region unknown).
   - **Proposal:** the moved file carries **only `crons`**. You check the region in the dashboard and decide.
   - Or: keep `regions` in it.
9. **#31 "feature on".** There's no payments flag in the code. **Proposal:** groups are all-or-nothing:
   - Cashfree group: `CASHFREE_ENV` + `CASHFREE_CLIENT_ID` + `CASHFREE_CLIENT_SECRET`;
   - LiveKit core;
   - S3 storage (`STORAGE_PROVIDER=s3` ⇒ its keys);
   - Supabase storage;
   - Zoho;
   - Google OAuth.

   None set means the feature is off (today's runtime 503s stay). Partly set means boot fails in production, or a warning in dev. Always required in production:
   - `DATABASE_URL`, `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `REDIS_URL` (prod already refuses to run sessions without it, FIX_BATCH_redis #5/#6);
   - `CRON_SECRET` in student-web.

   Or do you want an explicit `PAYMENTS_ENABLED=true` that makes Cashfree mandatory?

---

## #7: timeouts on outbound calls (1 commit)

| Call | Where | Change |
|---|---|---|
| Cashfree create order, refund (POST) | `packages/live-classes/src/cashfree.ts:86,173` | `signal: AbortSignal.timeout(10_000)`; timeout → `CashfreeError("Payment provider is not responding…", 504)`. **No retry** (POST). |
| Cashfree GETs | `cashfree.ts:72-82` (`getWithRetry`) | Same 10 s timeout per attempt; the existing single retry stays (GET only). |
| Google OAuth token (POST) + userinfo (GET) | `apps/teacher-web/src/lib/oauth.ts:53,72`; `packages/auth/src/oauth.ts:70,90` (in the audit, though nothing imports it) | 8 s timeout, clear error. No retry: the token exchange is single-use, and userinfo is just one call in the login flow. |
| FX rates | `packages/currency/src/index.ts:71` | 5 s timeout; the existing "stale beats broken" fallback stays. One retry is OK here (GET), but I'll keep it to the timeout unless you want the retry. |
| S3 (`@aws-sdk/client-s3`) | `apps/{student,teacher}-web/src/lib/storage.ts` (3 `new S3Client` each) | `requestHandler: { connectionTimeout: 5_000, requestTimeout: 10_000 }` |
| Supabase storage | same files (2 `createClient` each) | `global: { fetch: (u, i) => fetch(u, { ...i, signal: AbortSignal.timeout(10_000) }) }` |
| LiveKit `RoomServiceClient` / `EgressClient` | `packages/livekit/src/server.ts:148,158` | **Already has a 10 s default.** livekit-server-sdk 2.19.1 sets `requestTimeout ?? 10` s (`node_modules/livekit-server-sdk/dist/TwirpRPC.js:14,73`). So the audit's "no timeout" isn't accurate for LiveKit. I'll pass `{ requestTimeout: 8 }` explicitly and **test** it, not claim it as new. |
| Resend email | `apps/teacher-web/src/lib/{email,zoho-mailer}.ts`, `packages/auth/src/email.ts` | The SDK has no timeout option, but `post()` spreads per-request options into `fetch` (`resend/dist/index.mjs:1329-1335`). I'll pass `{ signal: AbortSignal.timeout(10_000) }`; if the types refuse, a narrow cast with a comment. |
| Zoho SMTP (nodemailer 9) | `apps/teacher-web/src/lib/zoho-mailer.ts:32` | `connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000` |

Tests: a real local `http.createServer` that accepts and never answers. Each `fetch`-based call (Cashfree POST/GET, both OAuth calls, FX, Resend, Supabase via its `fetch`, LiveKit via `TwirpRPC`) must reject within ~timeout+1 s with the clear error. The base URL is pointed at the slow server through env/injection. Real Cashfree/LiveKit/Google are never contacted.
- S3 and SMTP: a local TCP server that accepts and stays silent.
- Timeout values come from module constants that the tests override, so the suite doesn't wait 10 s per case.

Risk: a too-short timeout fails real slow calls. 10 s for Cashfree is generous (its p99 is far lower, NOT VERIFIED).

## #8: observability (proposed as 6 commits; see answer 1)

- **8a** `@sentry/nextjs` in the 3 web apps:
  - `src/instrumentation.ts` `register()` calls `Sentry.init` only if `SENTRY_DSN` is set;
  - `onRequestError = Sentry.captureRequestError`;
  - `instrumentation-client.ts` only if `NEXT_PUBLIC_SENTRY_DSN` is set;
  - `sendDefaultPii: false`; `beforeSend` strips `authorization`, `cookie`, `x-cashfree-*` headers and request bodies.

  Test: with no DSN, init isn't called. With a DSN, it's called and the scrubber removes those headers.
- **8b** Logger: one shared `packages/…` module, or a copy per app (I'll check which is smaller; same rule as before).
  - `log.info|warn|error(msg, fields)` writes one JSON line with `level`, `msg`, `time`, `requestId` and the fields.
  - Redaction by key (`password`, `otp`, `code`, `token`, `secret`, `authorization`, `cookie`, `signature`, `card*`, `upi*`/`vpa`, `payment_method`) and by value pattern (JWT, `Bearer …`, 16-digit card numbers, `x@upi`).
  - `withRequestLogger(request)` reads the ID as in answer 2.
  - teacher-web's proxy uses one ID per request.

  Tests: JSON shape; request ID carried; every redaction case.
- **8c** Replace `console.*` in payment + webhook paths: `packages/live-classes/src/{cashfree,coin-payments,payment-*,recording-payments,webhook*}.ts` and the `api/payments/*`, `api/webhooks/*` routes in both apps.
- **8d** Same for cron + auth paths (`api/cron/*`, `api/auth/*`, `lib/auth.ts`, `lib/redis-session.ts`, `oauth.ts`, `zoho-mailer.ts`).

  For 8c/8d: no behaviour change. Tests check that a representative error path logs JSON with the request ID and no secret. The ~130 other `console.*` calls (UI, misc) are left for later.
- **8e** Alerts: a `reportOpsAlert(kind, details)` that reuses `PAYMENT_ALERT_WEBHOOK_URL`'s delivery code. `OPS_ALERT_WEBHOOK_URL` is optional and falls back to the payment URL. Throttled to 1 per kind per 5 min per instance, so a Redis outage doesn't page on every request. Wired to:
  - unhandled 5xx (`onRequestError`);
  - DB/Redis probe failures (health routes);
  - Redis errors in `rateLimitRedis` / `redis-session`;
  - cron failures (non-200 or `failed.length`).

  Tests: each hook fires once, the throttle holds, and the payload has no secrets.
- **8f** `src/app/global-error.tsx` in all 3 apps: none exist; student/teacher have only `error.tsx`. It reports to Sentry when it's active. Plus `apps/admin-panel/src/app/api/health/route.ts`, same shape as student-web's (DB + Redis probe, no secrets, no auth). Tests: health returns 200/503 correctly with a mocked DB.

Risk: log volume and cost. The redaction rules are the main safety item, so they're tested hardest.

## #10: create the PaymentOrder row before Cashfree (needs its own "go")

`packages/live-classes/src/coin-payments.ts:69-79`:
1. Insert `PaymentOrder` (`CREATED`, receipt = orderId).
2. Call Cashfree.
3. If Cashfree throws, run `transitionOrder(db, {id}, "FAILED")` and rethrow, so the route returns the clean `CashfreeError` message and status.

Reconciler: Cashfree 404 on a CREATED/FAILED row → `EXPIRED` quietly (answer 5). The proof tests run against mocked `db` + `fetch` (no DB):
1. The DB insert throws, so Cashfree `fetch` is never called and the user gets 500 "Internal server error" (route unchanged).
2. Cashfree returns 4xx/5xx or times out, so the row is `FAILED` and the user gets 502/504 with the existing message.
3. Happy path unchanged.
4. Idempotency is unchanged: settlement (`transitionOrder` + `cashfree:<orderId>` credit key) and the existing reconciler tests still pass.
5. The sweep turns a 404'd FAILED row into EXPIRED with no `reconciliation_failed` alert.

Risk: a Cashfree timeout **after** Cashfree created the order leaves a row marked FAILED that exists at Cashfree. That's harmless: the student never got the `paymentSessionId`, so they can't pay it, and the sweep will see `ACTIVE`/`EXPIRED` and handle it.

## #20: cron safety (1 commit)

- `packages/live-classes/src/cron-lock.ts`: `withCronLock(name, budgetMs, fn)` runs `pg_try_advisory_xact_lock(hashtext(name))` in a `db.$transaction(..., { timeout: budgetMs + 10_000, maxWait: 5_000 })` (answer 6). If the lock isn't taken, it returns `{ skipped: "locked" }` with HTTP 200, so the workflow doesn't fail when a run overlaps.
- `reconcilePaymentOrders` / `reconcileStaleSessions` loop batches of 50 with a **cursor** `(createdAt, id)` until the batch is empty or the time budget (default 45 s) runs out. The cursor is needed because a still-unpaid row stays `CREATED`, and without it the loop would re-read it.
- Summary gains `batches`, `budgetExhausted`.
- `export const maxDuration = 60` on both student-web cron routes. 60 s is the Hobby limit; NOT VERIFIED which plan you're on.
- teacher-web `api/cron/*` → 410 (answer 7).
- Workflow comments are updated to say student-web.

Tests:
- Two concurrent runs against a fake lock: only one does work, the other returns `skipped` (unit test with an in-memory lock that has the same semantics as the advisory lock; real Postgres NOT VERIFIED).
- The budget stops the loop.
- The cursor never re-reads a row.
- teacher-web routes return 410.
- A 120-order backlog is fully processed in one run.

## #21: vercel.json (1 commit, code part only)

`git mv vercel.json apps/student-web/vercel.json`, keeping only `crons` (answer 8). The report will list what you must check in the dashboard (each project's Root Directory, Settings → Cron Jobs shows two jobs on student-web, Functions region, plan/`maxDuration`, `CRON_SECRET` set). I won't claim it works.

## #31: env validation (1 commit)

Per app, `src/env.ts`: a zod schema for that app's variables (from the grep of `process.env.*` in the app and the packages it uses), with the groups from answer 9.
- It's called from `register()` in `instrumentation.ts`, the same file as 8a, whichever commit lands first creates it.
- Production: throws one error listing every missing or invalid variable by **name only**, never the value.
- Development: `console.warn` with the same list.
- `next build` doesn't run `register()`, so builds aren't affected.

`.env.example` drift:
- Add `LIVEKIT_URL` as a documented alias of `LIVEKIT_WS_URL` (`packages/livekit/src/config.ts:174` reads both).
- Note that `JWT_SECRET` is **not read anywhere**: the only match is a comment in `admin-panel/src/lib/totp.ts:9`.
- Also document the missing ones the grep found: `MONITORING_API_KEY`, `NEXT_PUBLIC_ADMIN_URL`, `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_VAPID_KEY`, `ADMIN_COIN_DAILY_LIMIT`, `DEFAULT_TEACHER_TIME_ZONE`, `S3_*` (LiveKit egress), and the new `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `OPS_ALERT_WEBHOOK_URL`.
- I won't touch your local `.env`.

Tests:
- schema passes on a full prod env;
- each missing required var fails with its name;
- a partial Cashfree group fails, an empty one passes;
- in dev it warns instead of throwing;
- secret values never appear in the error.

Booting a real app with a bad env (`next start`) will be tried once and reported, or marked NOT VERIFIED if it can't run here.

## Order of work

**#7 → #20 → #21 → #31 → #8 (8a–8f) → #10 (after its own "go").**

#31 and 8a share `instrumentation.ts`, so #31 creates it. #10 comes last so it can use the logger.

## Follow-ups only (not in scope)

- #27: queue / retries / DLQ.
- #28: LiveKit room pre-creation (`listRooms` + `createRoom` per join).

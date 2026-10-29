# Production Readiness Audit — Language Metrics

_Status: COMPLETE (read-only audit). Branch `Priyanshu` @ `b9e2d2f`, audited 2026-10-19. No code files were changed._

## Verdict: **NOT READY** for thousands of concurrent users. Score: **44 / 100**

**Why.** The code is careful where money moves: idempotent settlement, a materialised coin ledger, advisory locks on bookings, signed and de-duplicated webhooks, and admin 2FA and lockout. All 401 unit tests pass, and typecheck and lint are clean. But the platform around that code won't survive load or an incident:

1. **Chat will overload the database.** Every open chat tab polls every 2–3 s, and each poll loads the *entire* message history with no limit.
2. **Redis handling isn't scale-safe.** Each rate-limit check opens a new TLS connection. Sessions and OTPs silently fall back to per-instance memory. Rate limiting fails open.
3. **No timeouts on any outbound call** (Cashfree, LiveKit, S3/Supabase, Google, FX).
4. **No error tracking, metrics or alerting** beyond a Slack webhook for payment incidents. Logs are unstructured `console.*`.
5. **Compliance promises aren't implemented.** "Data removed within 30 days" and "chat auto-deletes after 90 days" are shown to users, but no code does either.
6. **A real-format LiveKit API key and secret are in git history** on `main` and `origin`. The repo's own payment-security test suite also fails on private-key material in history.

Score breakdown (each area A–L out of ~8): Scalability 3, Database 4, Caching/queues 2, Reliability 2, Performance 4, Real-time 5, Security 5, Observability 1, Config/deploy 4, Testing 6, Compliance 2, Cost 4 → 42/96, normalised to **44/100**.

---

## 1. Discovery

### 1.1 Workspaces

| Workspace | Type | Stack | Evidence |
|---|---|---|---|
| `apps/teacher-web` | Public site + teacher dashboard + all auth (register/login/OTP/OAuth) + a **duplicate** of the student API (`/api/students/*`, `/api/payments/*`, `/api/webhooks/*`, `/api/cron/*`) | Next.js 16 (App Router), React 19, TS | `package.json` workspaces; route list (134 route files across apps) |
| `apps/student-web` | Student dashboard + mobile API `/api/v1/*` + Cashfree/LiveKit webhooks + crons | Next.js 16 | `apps/student-web/src/app/api/**` |
| `apps/admin-panel` | Admin dashboard (RBAC, TOTP 2FA, refunds, payouts, live room control) | Next.js 16 | `apps/admin-panel/src/app/api/**` |
| `apps/student-mobile` | Expo / React Native client of `/api/v1/*` | Expo | `apps/student-mobile/app.json`, `eas.json` |
| `packages/database` | Prisma 5 schema, migrations, coin ledger | Prisma + PostgreSQL | `packages/database/prisma/schema.prisma` (948 lines, 9 migrations) |
| `packages/auth` | RS256 JWT (jose), Redis refresh sessions, OAuth, email | ioredis | `packages/auth/src/*` |
| `packages/live-classes` | Booking, settlement, Cashfree, webhooks, reconciliation | — | `packages/live-classes/src/*` |
| `packages/livekit` | LiveKit server SDK wrapper, metering, cost model | livekit-server-sdk | `packages/livekit/src/*` |
| `packages/classroom`, `ui`, `currency`, `languages`, `api-contracts` | Shared UI / helpers | — | — |

- **Language:** TypeScript everywhere (plus a Python security test suite in `tests/security`).
- **Database:** PostgreSQL on Supabase via the Supavisor/PgBouncer pooler (local `.env` `DATABASE_URL` host `***.pooler.supabase.com:6543`, param `pgbouncer` present, **no `connection_limit` param**; values masked).
- **Cache/session store:** Upstash Redis (`rediss://***.upstash.io:6379`) via raw `ioredis` TCP connections.
- **Queue:** **None.** No BullMQ/QStash/SQS anywhere. Background work = two HTTP "cron" endpoints pinged by GitHub Actions every 10 min (`.github/workflows/reconcile-*.yml`) and a daily Vercel cron (`vercel.json`).
- **Hosting:** Vercel, one project per app with Root Directory `apps/<app>` (`README.md` "Deployment"), region `hnd1` (Tokyo) (`vercel.json:2-4`).
- **Real-time:** LiveKit Cloud (WebRTC SFU). Chat is **HTTP polling** (`setInterval` in `apps/*/chat/page.tsx`), not WebSockets.

### 1.2 Architecture diagram

```
                         ┌──────────────────────── Vercel (region hnd1) ─────────────────────────┐
 Browser (student) ────► │ student-web  (Next.js serverless fns)                                  │
 Browser (teacher) ────► │ teacher-web  (Next.js serverless fns)  ← also serves /api/students/*   │
 Browser (admin)  ─────► │ admin-panel  (Next.js serverless fns)                                  │
 Expo mobile app ──────► │ student-web /api/v1/*  (Bearer JWT, CORS proxy.ts)                    │
                         └───────┬───────────────┬───────────────┬────────────────┬──────────────┘
                                 │ Prisma        │ ioredis (TCP) │ fetch (no      │ SDKs
                                 ▼               ▼               │  timeouts)     ▼
                     Supabase Postgres     Upstash Redis         │        Supabase Storage / S3
                     (pooler :6543)        refresh tokens,       │        (public URLs)
                                           rate limits, OTP      │
                                                                 ├──► Cashfree PG (orders, refunds)
                                                                 ├──► LiveKit Cloud API (rooms, egress)
                                                                 ├──► Google OAuth
                                                                 ├──► Resend / Zoho SMTP (email OTP)
                                                                 ├──► api.frankfurter.dev (FX rates)
                                                                 └──► Slack/Discord alert webhook
 Inbound webhooks:  Cashfree ──► /api/webhooks/cashfree   LiveKit ──► /api/webhooks/livekit
                    (both exist in student-web AND teacher-web)
 Schedulers:        GitHub Actions */10 min ──► APP_URL/api/cron/reconcile-{payments,sessions}
                    Vercel cron (daily, root vercel.json — see finding on whether it is active)
 Browsers ──WebRTC──► LiveKit Cloud SFU (room "class-<sessionId>")
```

### 1.3 External services and failure behaviour

| Service | Used for | What happens if it is down | Evidence |
|---|---|---|---|
| Supabase Postgres | All data | Every API fails (500). No read replica, no circuit breaker. | `packages/database/src/index.ts:3-21` |
| Upstash Redis | Refresh tokens, rate limits, OTP, idempotency | **Inconsistent:** `@repo/auth` throws (`redis-session.ts:26`); student/teacher `lib/redis-session.ts` silently falls back to a per-instance in-memory Map and never retries Redis for that instance's lifetime (`apps/student-web/src/lib/redis-session.ts:88,109`); rate limiter **fails open** (`apps/student-web/src/lib/rate-limit.ts:106-109`). | see §2 |
| Cashfree | Coin purchase, recording unlock, refunds | Order create returns 502; checkout verification fails; orders stay `CREATED` and the 10-min reconciler retries. No timeout, so a *slow* Cashfree holds serverless functions open until the platform kills them. | `packages/live-classes/src/cashfree.ts:72-99` |
| LiveKit Cloud | Live classes, recording | Token/room creation fails → students cannot join. Runbook says refund manually. Session reconciler settles from whatever presence data arrived. | `docs/runbook.md` Scenario 2 |
| Supabase Storage / S3 | Avatars, teacher documents, recordings | Uploads 500. If `STORAGE_PROVIDER` is unset it silently writes to local disk (lost on Vercel). | `apps/teacher-web/src/lib/storage.ts:23,90-91` |
| Resend / Zoho SMTP | Email OTP, verification, password reset | Users cannot register/verify/reset. NOT VERIFIED whether a retry exists (see §2 D). | `apps/teacher-web/src/lib/zoho-mailer.ts:32,81` |
| Google OAuth | Social login | Google login fails; password login still works. | `packages/auth/src/oauth.ts:70,90` |
| api.frankfurter.dev | FX display prices | Falls back to last cached rate; throws only if never fetched; `convertMinorUnitsSafe` returns INR. No timeout. | `packages/currency/src/index.ts:64-83` |
| Payment alert webhook | Ops alerts | Best-effort with a timeout (`AbortSignal.timeout`). | `packages/live-classes/src/payment-incidents.ts:43-46` |
| Push notifications | — | **Not implemented:** `DeviceToken` rows are stored but nothing sends pushes (no Expo/FCM SDK found by grep). | `schema.prisma:918-926` |
| AI APIs | — | None found. | grep |
| SMS | — | None found. | grep |

---

## 2. Findings table

Severity: **Blocker** = will fail or cause harm at launch scale. **High** = likely incident at scale. **Medium** = degrades or creates risk. **Low** = hygiene.

| # | Severity | Area | File:Line | Issue | Fix |
|---|---|---|---|---|---|
| 1 | **Blocker** | B/E Perf | `apps/student-web/src/app/api/students/chat/[teacherId]/route.ts:67-75`; `apps/student-web/src/app/(authenticated)/chat/page.tsx:100` | Open conversation polled every **2 s**. Each poll returns the **whole** history: `findMany({ where: { OR: [...] }, orderBy: { createdAt: "asc" } })`, no `take`. Same code in `apps/teacher-web/src/app/api/teachers/chat/[studentId]/route.ts:19` and `.../students/chat/[teacherId]/route.ts:17`. | Cursor pagination (`take: 50`, `createdAt > lastSeen` for polls). Add index `(senderId, receiverId, createdAt)`. Poll at 10–15 s with backoff, or move to SSE / Supabase Realtime. |
| 2 | **Blocker** | B/E Perf | `apps/student-web/src/app/api/students/chat/route.ts:15-23,33-44`; `chat/page.tsx:92` | Thread list polled every **3 s**. It loads *all* bookings with `include: { teacher: { include: { user: true } } }` (pulls password hashes and TOTP secrets into memory), then *all* messages with every teacher. Cost per poll grows with history. 1,000 users on chat ≈ 330 req/s of full scans. | Query distinct counterparts with one `DISTINCT ON` / `groupBy` plus a `take`. `select` only the needed columns, never `user: true`. Cache per user for a few seconds. |
| 3 | **Blocker** | A/C Redis | `apps/student-web/src/lib/rate-limit.ts:81-102` (same in `apps/teacher-web/src/lib/rate-limit.ts:~86`) | `rateLimitRedis()` does `new Redis(redisUrl, …)` **on every call**, then `quit()`. Each login, booking, token or upload request opens a new TLS connection to Upstash. Under load this exhausts Upstash's concurrent-connection cap and adds 50–200 ms per request. | Use one module-level client, or Upstash's HTTP client (`@upstash/ratelimit` + `@upstash/redis`), which suits serverless. |
| 4 | **High** | G Security | `apps/student-web/src/lib/rate-limit.ts:106-110` | On any Redis error the limiter returns `false` (**fails open**), despite the log saying "falling back". Login brute-force protection disappears whenever Redis hiccups. | For auth and payment routes, fail closed (429/503) or fall back to the in-process limiter as the comment claims. |
| 5 | **High** | A Stateless | `apps/student-web/src/lib/redis-session.ts:88,108-110,129-132` (same in teacher-web) | On one Redis error, `_redisAvailable = false` **for that instance's lifetime**, and refresh sessions go to a per-instance `Map`. On a multi-instance deploy, users get random logouts and "reused token" rejections. A revoked session can stay valid on another instance. | Remove the in-memory fallback in production (fail with 503) and let ioredis reconnect. Keep the fallback only for `NODE_ENV=development`. |
| 6 | **High** | A Stateless | `apps/teacher-web/src/lib/redis-client.ts:28,57-79`; `apps/teacher-web/src/app/api/auth/send-registration-otp/route.ts:104-123`; `verify-registration-otp/route.ts:48-52` | `getRedisClient()` **always returns `null` on the first call** of each instance ("On the first call, return null"). After one failed connect it stays `null` forever. On a cold start, the registration OTP goes to instance memory with no rate limit. Verification on another instance then says "No pending verification". | Await the connection, or use the Upstash HTTP client. Never use the in-memory OTP store outside development. |
| 7 | **High** | D Reliability | `packages/live-classes/src/cashfree.ts:75,86,173`; `packages/auth/src/oauth.ts:70,90`; `packages/currency/src/index.ts:71`; `packages/livekit/src/server.ts:179-188`; `apps/teacher-web/src/lib/storage.ts:138-153` | **No timeout** on any outbound call except the alert webhook (`payment-incidents.ts:46` uses `AbortSignal.timeout`). A slow Cashfree or LiveKit holds functions open until Vercel kills them, piling up concurrency and DB connections. | Add `signal: AbortSignal.timeout(5000–10000)` to every `fetch`. Set `requestHandler` timeouts on `S3Client`. Wrap LiveKit SDK calls with a timeout. |
| 8 | **High** | H Observability | grep across `apps/*/src`, `packages/*/src` (no `@sentry`, `pino`, `winston`, OpenTelemetry; 229 `console.*` calls) | No error tracking, no structured logs, no metrics. `X-Request-ID` is set on responses (`apps/teacher-web/src/proxy.ts:136,143,201`) but never logged, so it can't be correlated. | Add Sentry (or similar) to all three apps via `instrumentation.ts`, a JSON logger carrying the request ID, and alerts on 5xx rate, p95 latency, DB/Redis errors and cron failures. |
| 9 | **High** | B Database | `packages/database/src/index.ts:3-21`; local `.env` `DATABASE_URL` has `pgbouncer` but **no `connection_limit`** (values masked) | Prisma's default pool is `num_cpus*2+1` **per function instance**. With hundreds of warm Vercel instances across 3 apps, Supavisor and Postgres connection limits are exceeded ("too many clients" / P1001). Production env values: NOT VERIFIED. | Set `?pgbouncer=true&connection_limit=1` (or 2–3) on `DATABASE_URL` in Vercel. Size the Supabase pooler. Consider Prisma Accelerate or a Data Proxy. |
| 10 | **High** | Payments | `packages/live-classes/src/coin-payments.ts:74-77` | The Cashfree order is created **before** the `PaymentOrder` row. If the insert fails (DB blip, pool exhausted), the student still gets a payable session and pays. The reconciler only scans DB rows (`payment-reconciliation.ts:54`), so the money is taken and never credited or detected. | Insert the `PaymentOrder` row (status `CREATED`) first, then call Cashfree. Mark the row `FAILED` if Cashfree rejects. |
| 11 | **High** | G Secrets | git history commit `fc5f3be` (2026-09-26) `.env.example:78-79`, present on `main`, `origin/main` and other branches | `LIVEKIT_API_KEY` (15-char `API…` literal) and `LIVEKIT_API_SECRET` (43-char literal) were committed. Hashes differ from the current local `.env`, but whether the key is still active in any LiveKit project is NOT VERIFIED. Repo visibility is NOT VERIFIED (no `gh` CLI). | Revoke that key pair in LiveKit Cloud now. Rewrite history only if the repo is or was public. Add gitleaks as a required check on all PRs (today it only runs on admin-panel paths, `.github/workflows/security.yml:23-31`). |
| 12 | **High** | G Secrets / J | `tests/payment-security/09-secret-scan.test.ts:76-78` → **fails** on commit `159f42f` `apps/student-web/src/lib/tokens.ts` | `npm run test:payments` output: `1 failed | 180 passed | 2 skipped`. Private-key block in history (293 base64 chars, shorter than a full RSA-2048 key, so likely a sample or truncated key). | Confirm that key was never used, then record it in `.gitleaksignore` with justification, or rewrite history. Add `test:payments` to CI (`quality.yml` doesn't run it). |
| 13 | **High** | K Compliance | `apps/student-web/src/app/api/students/profile/request-deletion/route.ts:44-47,59` | Says "Your data will be removed within 30 days" but only sets `status: "SUSPENDED"`. No job, admin queue or code anonymises or deletes anything. No deletion path for teachers. No data export anywhere. | Build an erasure job (anonymise PII; keep financial rows, which are already `RESTRICT`), an admin queue for requests, and a data-export endpoint. |
| 14 | **High** | K Compliance | `apps/student-web/src/app/api/students/chat/[teacherId]/route.ts:192-201`; `schema.prisma:439,445` | Messages get `autoDeleteAt = now + 90 days` and the UI shows an auto-delete label, but **nothing deletes them** (grep finds no `deleteMany` on `autoDeleteAt`). The table grows forever and users are told otherwise. | Add a daily cron: `DELETE FROM "ChatMessage" WHERE "autoDeleteAt" < now()`, in batches. |
| 15 | **High** | G/K PII | `apps/teacher-web/src/lib/storage.ts:152` (`ACL: "public-read"`), `:223` (`getPublicUrl`); `apps/teacher-web/src/app/api/auth/upload/route.ts:7-15,83-89` | Teacher onboarding documents (schema has `DocumentType.ID_PROOF`) are uploaded **anonymously** to a public bucket path `temp/…` and returned as public URLs. Anyone with the URL can read an ID proof. Temp files are never cleaned up. | Use a private bucket with short-lived signed URLs. Require a registration token for uploads. Run a lifecycle rule on `temp/`. |
| 16 | **High** | G Deps | `npm audit --omit=dev`: **26 vulns (19 high, 7 moderate)** | High: `nodemailer <=10.0.8` (used by Zoho SMTP, `apps/teacher-web/src/lib/zoho-mailer.ts:32`), `axios 1.0.0-1.19.0` (used in `apps/teacher-web/src/lib/api.ts`), `source-map-js`, plus `braces` and `node-forge` via Expo. | `npm audit fix` for nodemailer, axios and source-map-js. Plan the Expo upgrade separately. Make `npm audit --audit-level=high` blocking in CI (today it's `|| true` and only fails on *critical*, `security.yml:142,164-176`). |
| 17 | Medium | G CSP | `apps/student-web/next.config.ts:20-34` | **student-web sends no Content-Security-Policy** (teacher-web and admin do). This is the app that runs Cashfree checkout and the LiveKit classroom. | Copy teacher-web's CSP builder (`apps/teacher-web/next.config.ts:13-146`). |
| 18 | Medium | G CSRF | `apps/student-web/src/proxy.ts:86-88` (matcher `/api/v1/*` only); `apps/student-web/src/lib/tokens.ts:107-121` | Cookie-auth mutating routes on student-web (`/api/students/*`, `/api/payments/*`) have **no Origin check**. teacher-web has one (`apps/teacher-web/src/proxy.ts:94-128`). The only defence is `SameSite=Lax`. | Add the same Origin and Host check to student-web's proxy for POST/PUT/PATCH/DELETE. |
| 19 | Medium | G Rate limit | `apps/student-web/src/app/api/payments/create-order/route.ts:6-15` | Coin order creation has **no rate limit**. Each call creates a Cashfree order and a DB row, so a script can burn the platform's Cashfree API quota and flood the reconciler. 27 of 133 route files rate-limit at all. | Per-user limit (e.g. 5/min). Reuse an open `CREATED` order for the same pack within its 30-min TTL. |
| 20 | Medium | A Cron | `packages/live-classes/src/payment-reconciliation.ts:31,54-62`; `.github/workflows/reconcile-payments.yml:27,35-37` | No DB lock: GitHub Actions `concurrency` stops GH runs overlapping, but not GH and Vercel cron, or two deployments (both student-web **and** teacher-web expose `/api/cron/*`). Settlement is idempotent, so the effect is duplicate Cashfree calls, not double credit. `BATCH_SIZE=50` oldest-first every 10 min = 300 orders/h max; above that the backlog grows. No `maxDuration` set. | Take `pg_try_advisory_lock` at the start of each sweep. Loop batches until a time budget runs out. Set `export const maxDuration`. Serve cron from one app only. |
| 21 | Medium | I Cron | `vercel.json:5-14` (repo root) vs README "Root Directory set to `apps/<app>`" | Vercel reads `vercel.json` from the project's root directory, so the "daily fallback" cron is **likely not registered**. NOT VERIFIED (no Vercel dashboard access). Payment and session reconciliation then depend only on GitHub's best-effort scheduler and two repo secrets. | Check Vercel → Settings → Cron Jobs. Move `vercel.json` into `apps/student-web/`. Alert if a reconcile run hasn't succeeded in 30 min. |
| 22 | Medium | B Index | `schema.prisma:930-948` (`PaymentOrder` has only `@@index([userId])`) | Reconciler queries `status IN (...) AND createdAt BETWEEN …` (`payment-reconciliation.ts:54-62`) and `status = 'REFUND_PENDING' ORDER BY updatedAt` (`:94-98`). These are sequential scans on a table that grows with every checkout. | `@@index([status, createdAt])`, `@@index([status, updatedAt])`. |
| 23 | Medium | B Index | `schema.prisma:433-446` | `ChatMessage` has `(senderId, receiverId)` only. Queries are `OR` of both directions `ORDER BY createdAt`. FK columns without indexes: `Payout.teacherId` (415), `TeacherDocument.teacherId` (115), `Interview.teacherId` (129), `Payment.userId` (396), `Review.studentId` (450), `DeviceToken.userId` (918), `Complaint.studentId` (630). `AdminAuditLog` has no index at all (497). | Add `(senderId, receiverId, createdAt)` and `(receiverId, senderId, createdAt)`, plus FK indexes. Use `CREATE INDEX CONCURRENTLY` in a manual migration. |
| 24 | Medium | B Pagination | e.g. `apps/teacher-web/src/app/api/teachers/wallet/route.ts:17`; `apps/student-web/src/app/api/students/recordings/route.ts:14`; `.../students/classes/route.ts:56`; `.../students/complaints/route.ts:28`; `apps/teacher-web/src/app/api/teachers/schedule/route.ts:94`; `apps/teacher-web/src/features/teacher/services/teacher-service.ts:231,412`; admin pages `security/page.tsx:11`, `invoices/page.tsx:12`, `notifications/page.tsx:8`, `classes/page.tsx:21`, `payouts/page.tsx:18` | 57 `findMany` calls without `take` across the apps and `live-classes` (some are bounded by a parent filter, e.g. `id in [...]`). Fine at launch, but each grows linearly per user or per platform. Admin `SecurityEvent` and `Booking` lists will become multi-MB pages. | Add `take` plus cursor to every list endpoint and admin table. |
| 25 | Medium | B Perf | `apps/student-web/src/app/api/students/discover/route.ts:83-85,97-100` | Discover loads **every review row** for each teacher to compute an average in JS. A popular teacher with thousands of reviews makes every discover page heavy. | Use `_avg`/`_count` via `groupBy`, or store `ratingAvg`/`ratingCount` on `TeacherProfile`. |
| 26 | Medium | C Cache | `apps/student-web/src/lib/api-cache.ts:15,91-95` | Response cache is a per-instance `Map`. `invalidateCache("discover:")` after a booking (`book/route.ts`) only clears **that** instance, so other instances serve stale data for up to 60 s. Hit rate is low on serverless. | Move hot-read caching to Redis (or `unstable_cache`/`revalidateTag`) with shared invalidation. |
| 27 | Medium | C Queue | (no queue anywhere) | Email, Cashfree calls, LiveKit room creation and recording egress all run inline in the request. No retry with backoff (only one GET retry, `cashfree.ts:72-82`) and no dead-letter queue. Failed webhook events are kept in `WebhookEvent.error` but nothing replays them. | Add a queue (Upstash QStash, Inngest or Vercel Queues) for email, recording start/stop and reconciliation, with retries and a DLQ. |
| 28 | Medium | D Reliability | `packages/livekit/src/server.ts:179-188`; `packages/live-classes/src/handlers.ts:110` | Every join makes 2 LiveKit API calls (`listRooms` + `createRoom`). When classes start on the hour, thousands of joins hit LiveKit's server API at once; there is no breaker or backoff. | Create the room once, ahead of time (cron at T-5 min), or cache "room ensured" per session in Redis. Treat createRoom "already exists" as success. |
| 29 | Medium | E Upload | `apps/teacher-web/src/app/api/auth/upload/route.ts:38,69,86` | Whole multipart body is buffered in memory before the size check. Vercel serverless request bodies cap at ~4.5 MB, so the 10 MB limit is unreachable and larger files fail with a platform 413. | Presigned direct-to-storage uploads (S3 / Supabase signed upload URL), and reject early on `content-length`. |
| 30 | Medium | E Storage | `apps/teacher-web/src/lib/storage.ts:23,90-91` | `STORAGE_PROVIDER` defaults to `"local"` and writes to `public/uploads`. That's read-only/ephemeral on Vercel: uploads fail or vanish if the env var is missing. A new `S3Client` per call (`:138,171,191`) means no connection reuse. | Throw at startup if `STORAGE_PROVIDER` is unset in production. Reuse one client. |
| 31 | Medium | I Config | no `env.ts` / `instrumentation.ts` in any web app | No startup env validation. Missing `CRON_SECRET`, `CASHFREE_*`, `LIVEKIT_*` or `REDIS_URL` only show up on first use (some fail closed, which is good, e.g. `cashfree.ts:39-44`, `reconcile-sessions/route.ts:47-55`). Local `.env` carries `JWT_SECRET` and `LIVEKIT_URL`, which `.env.example` doesn't document (it uses `LIVEKIT_WS_URL`), a sign of drift. | A zod env schema per app, imported from `instrumentation.ts`, that fails the boot. |
| 32 | Medium | I Deploy | `package.json:21` (`build` runs only `prisma generate`); migrations like `20260925000000_livekit_integration/migration.sql:159-183` | Migrations are applied by hand, forward-only (Prisma has no down migrations), and use plain `CREATE INDEX` / `ADD CONSTRAINT … CHECK` without `CONCURRENTLY`/`NOT VALID`. These lock big tables during deploys. No staging-first migration step in CI. | Run `prisma migrate deploy` in a gated CI job against staging, then production. Use `CONCURRENTLY` / `NOT VALID` + `VALIDATE` for big tables. Write a rollback SQL file per migration. |
| 33 | Medium | Arch | 32 duplicated route files: `apps/teacher-web/src/app/api/students/**`, `.../payments/**`, `.../webhooks/**`, `.../cron/**` mirror `apps/student-web` | Same endpoints in two apps, so fixes drift (e.g. the student-web chat route sanitises at `:77-85`; check the teacher-web copy). Two Cashfree webhook URLs and two cron targets. | Serve the student API from student-web only and delete the teacher-web copies (needs a client routing change). |
| 34 | Medium | Booking | `apps/student-web/src/app/api/v1/bookings/route.ts:73-161` vs `packages/live-classes/src/booking.ts:284-317` | The mobile API re-implements booking: hardcoded `commissionPct = 20` (`:113`), default 500 coins/h, no demo rules, no availability-window check that `bookClass` may apply. Mobile and web can price the same class differently. | Call `bookClass()` from `@repo/live-classes` in the v1 route. |
| 35 | Medium | G Auth | `apps/teacher-web/src/app/api/auth/login/route.ts:27-29`; `apps/student-web/src/app/api/auth/login/route.ts:21-22` | Student and teacher login are rate-limited **per IP only**. No per-account limit or lockout, so distributed credential stuffing isn't slowed. (Admin does this correctly, `apps/admin-panel/src/lib/auth-service.ts:55-100`.) | Add a per-email sliding window and a temporary lockout, as admin does. |
| 36 | Low | H Info leak | `apps/teacher-web/src/app/api/monitoring/route.ts:18` | `origin.includes(host)` "same-origin" check is trivially spoofed by any non-browser client sending an `Origin` header. Returns raw DB error messages. | Require `MONITORING_API_KEY` only, with a constant-time compare. |
| 37 | Low | G Webhook | `packages/live-classes/src/cashfree.ts:190-196` | No timestamp freshness check, so valid webhooks can be replayed. Harmless today because settlement is idempotent. | Reject `x-webhook-timestamp` older than 5 min. |
| 38 | Low | C Idempotency | `apps/student-web/src/lib/idempotency.ts:13-16` | `SETNX` then `EXPIRE` isn't atomic (a crash leaves a key with no TTL), and it fails open without Redis. | `SET key 1 NX EX 604800`. |
| 39 | Low | E Memory | `apps/student-web/src/lib/rate-limit.ts:25`; `apps/teacher-web/src/proxy.ts:22-33` | In-process limiter `Map` is never pruned in `rate-limit.ts` (the proxy one prunes past 1,000 entries). Slow memory growth on long-lived instances. | Prune on write, or remove once Redis is mandatory. |
| 40 | Low | Auth | `packages/auth/src/redis-session.ts:102-110` | Shared package rotation uses a non-transactional pipeline that SETs the new key even when the old one was missing (theft case). The app-level copies use `GETDEL` correctly. | Use `GETDEL` then conditional `SET` (as `apps/student-web/src/lib/redis-session.ts:193-196`), or a Lua script. |
| 41 | Low | Push | `schema.prisma:918-926`; `apps/student-web/src/app/api/students/device-tokens/route.ts` | Device tokens are collected, but no push sender exists. | Implement or remove. |

---

## 3. A–L checklist

| Area | Item | Result | Evidence / finding # |
|---|---|---|---|
| **A Scalability** | Stateless servers | **FAIL** | Sessions, OTPs, cache and rate limits fall back to instance memory (#5, #6, #26); local-disk storage default (#30) |
| | Multiple instances safe | **FAIL** | Same as above |
| | Cron / jobs protected from double-run | **FAIL** (mitigated) | No lock; idempotent settlement limits the damage (#20) |
| **B Database** | Indexes on WHERE/JOIN/ORDER BY | **FAIL** (partial) | Good indexes on Booking, ClassSession, Notification, CoinTransaction; gaps in #22, #23 |
| | N+1 queries | **PASS** (mostly) | Chat N+1 already fixed (`chat/route.ts:27-44`); discover uses one query with `include` |
| | Connection pooling and size | **FAIL / NOT VERIFIED** | No `connection_limit` (#9); production value not visible |
| | Pagination on every list | **FAIL** | Discover is cursor-paginated (`discover-query.ts:153-165`); 50+ lists aren't (#1, #2, #24) |
| | Slow query risk | **FAIL** | Full chat history polling (#1, #2), review scan (#25), `ILIKE '%x%'` on teacher name (`discover-query.ts:88`) |
| | Transactions | **PASS** | Booking: advisory lock + hold in one tx (`booking.ts:188-190,284-317`); ledger conditional updates (`coin-ledger.ts:19-22`) |
| | Migrations safe and reversible | **FAIL** | Forward-only, non-concurrent, manual (#32) |
| | Backups and restore | **NOT VERIFIED** | Runbook claims Supabase daily snapshots, RPO < 24 h (`docs/runbook.md` Scenario 1); no restore drill evidence; PITR plan unknown |
| **C Cache/queues** | Heavy work on a queue | **FAIL** | No queue (#27) |
| | Cache for hot reads | **FAIL** (partial) | Per-instance only (#26); FX rates cached 6 h (`currency/src/index.ts:56`) |
| | Cache invalidation | **FAIL** | Instance-local (#26) |
| | Retry with backoff | **FAIL** (partial) | One retry on Cashfree GETs; LiveKit webhooks retried by LiveKit plus the `WebhookEvent` claim (`webhook.ts:47-84`) |
| | Dead-letter queue | **FAIL** | None; `WebhookEvent.error` is recorded but never replayed |
| **D Reliability** | Timeouts on every outbound call | **FAIL** | #7 |
| | Retries only where safe | **PASS** | Retries only on idempotent GETs (`cashfree.ts:68-82`); refunds use a deterministic id (`cashfree.ts:166-177`) |
| | Circuit breaker / fallback | **FAIL** (partial) | FX falls back to a stale rate; LiveKit budget gate; nothing for Cashfree or LiveKit API outages |
| | Graceful shutdown | **N/A / NOT VERIFIED** | Serverless on Vercel; no custom server; no SIGTERM handling needed |
| | No unhandled rejections | **PASS** (spot-checked) | Routes read wrap work in try/catch; cron routes don't, but Next returns 500 |
| | Global error handler | **FAIL** (partial) | `error.tsx` in student-web and teacher-web; **no `global-error.tsx`** anywhere; admin-panel has no `error.tsx` |
| **E Performance** | Response compression | **PASS** | `compress: true` (`teacher-web/next.config.ts:70`); Vercel compresses at the edge |
| | Payload size limits | **PASS** (partial) | `exceedsMaxBodySize` 16 KB on auth routes (`rate-limit.ts:120-127`); not applied everywhere |
| | File upload limits | **FAIL** (partial) | 10 MB check after full buffering; 4.5 MB platform cap (#29) |
| | Streaming big files | **FAIL** | No presigned upload; recordings via LiveKit egress straight to bucket (OK) |
| | Memory leak risks | **FAIL** (Low) | #39 |
| | Blocking code in request path | **PASS** (minor) | `bcryptjs` cost 10 (`auth-service.ts:61`) is acceptable |
| | Frontend bundle size | **NOT VERIFIED** | `next build` not run |
| | Image / CDN | **PASS** (partial) | `next/image` remotePatterns and AVIF/WebP; Supabase storage host missing from teacher-web CSP `img-src` (`next.config.ts:139`), so uploaded avatars may be blocked (NOT VERIFIED at runtime) |
| **F Real-time** | Live-class scaling | **PASS** | LiveKit Cloud SFU, one room per class, `maxParticipants`/`emptyTimeout` set (`livekit/src/server.ts:182-188`) |
| | Pub/sub across instances | **N/A** | No in-app WebSockets; chat is HTTP polling (#1, #2) |
| | Reconnect handling | **PASS** | Per-connection participant rows; departure timeout (`schema.prisma:296-321`, `config.ts:187`) |
| | Limits per user / room | **PASS** | 20 tokens/min/user (`api/live/token/route.ts:27-30`); room max participants; monthly budget gate (`usage.ts:191-204`) |
| **G Security** | Auth on all routes | **PASS** | All 133 route files checked: every non-public route calls `requireAuth`, `requireMobileAuth`, `requireApiAdmin`, CRON_SECRET or a webhook signature. Public by design: auth/register/OTP/OAuth, health, `v1/teachers` |
| | Rate limiting | **FAIL** (partial) | #3, #4, #19, #35 |
| | Input validation | **PASS** (partial) | zod on admin, refund and v1; hand-rolled validators elsewhere |
| | CORS | **PASS** | Allow-list, no `*`, no credentials (`student-web/src/proxy.ts:42-84`) |
| | CSRF | **FAIL** (partial) | #18 |
| | Security headers / CSP | **FAIL** (partial) | #17 |
| | Secrets only in env | **PASS** (HEAD) | `.env` gitignored (`.gitignore:23`); `.env.example` HEAD values empty |
| | Dependency audit | **FAIL** | #16 |
| | No secrets in git history (full) | **FAIL** | #11, #12 |
| | Safe error messages | **PASS** (mostly) | Generic 500s; except #36 |
| **H Observability** | Structured logs + request IDs | **FAIL** | #8 |
| | No sensitive data in logs | **PASS** (mostly) | OTP printed only when `NODE_ENV !== "production"` (`send-registration-otp/route.ts:125-129`); raw Prisma errors may include emails |
| | Error tracking | **FAIL** | #8 |
| | Metrics | **FAIL** | None |
| | Health / readiness endpoints | **PASS** (partial) | `/api/health` in student-web and teacher-web (DB + Redis), none in admin-panel; returns 200 when Redis is down |
| | Uptime alerts | **NOT VERIFIED** | Runbook names a status page; no config in repo |
| | Payment / queue / DB alerts | **FAIL** (partial) | Payment incidents go to Slack/Discord (`payment-incidents.ts`) if `PAYMENT_ALERT_WEBHOOK_URL` is set; nothing for DB, Redis or cron |
| **I Config/deploy** | Separate dev/staging/prod config | **NOT VERIFIED** | Per-environment Vercel vars implied; `CASHFREE_ENV` enforced (`cashfree.ts:39-55`) |
| | Env validation at startup | **FAIL** | #31 |
| | CI/CD pipeline | **PASS** | `quality.yml`: structure, typecheck, test, lint on every PR |
| | Automated tests in CI | **PASS** (partial) | Unit tests yes; `test:payments` and e2e not in CI |
| | Zero-downtime deploy | **PASS** (platform) | Vercel atomic deploys; DB migrations aren't (#32) |
| | Rollback plan | **PASS** (app) / **FAIL** (DB) | Vercel instant rollback (`docs/runbook.md` §2); no DB rollback |
| | Docker / reproducible build | **FAIL** (partial) | No Dockerfile; `package-lock.json` + `.nvmrc` present; `build` uses unpinned `npx prisma@5` (`package.json:21`) |
| | HTTPS / domain | **PASS** (partial) | HSTS headers; custom domain NOT VERIFIED (README lists `*.vercel.app`) |
| | Feature flags | **FAIL** | `PlatformSetting` table exists; no flag system found |
| **J Testing** | Critical-flow coverage | **PASS** (unit) | Booking concurrency, settlement, webhooks, payments, auth tests exist; e2e not run |
| | Typecheck clean | **PASS** | `npm run typecheck` EXIT 0 across 11 workspaces (`@repo/database` and `@repo/auth` have no typecheck script) |
| | Lint clean | **PASS** | `npm run lint` EXIT 0 (`--max-warnings 0`), 6 workspaces |
| | Full test suite output | **PASS** | `npm test`: **401 passed / 0 failed** (admin 32, student-web 111, teacher-web 141, classroom 6, currency 13, database 4, live-classes 46, livekit 44, ui 4) |
| | Payment security suite | **FAIL** | `npm run test:payments`: **180 passed, 1 failed, 2 skipped** (#12). Skipped: `07-payment-methods.sandbox.test.ts:18` (no sandbox creds), `10-db-integrity.test.ts:81` (no test DB) |
| | E2E / Python security suite | **NOT VERIFIED** | Not run (needs running servers and DB) |
| **K Data/compliance** | Deletion and export | **FAIL** | #13 |
| | PII protection | **FAIL** | #15 |
| | Data retention | **FAIL** | #14; `SecurityEvent`, `LoginAttempt`, `WebhookEvent` grow forever |
| | Privacy / terms pages | **PASS** | `apps/teacher-web/src/app/{privacy,terms,cookies}`; student-web copies sit under `(authenticated)` |
| | Backup encryption | **NOT VERIFIED** | Supabase-managed |
| **L Cost/limits** | Third-party quotas | **FAIL** (partial) | LiveKit budget gate is good (`usage.ts:191-204`); Cashfree order spam (#19); LiveKit API burst (#28); Upstash connection churn (#3) |
| | Unbounded loops / queries | **FAIL** | #1, #2, #24, `payment-integrity.ts:36,57-67` loads whole tables (admin-triggered) |
| | File storage growth | **FAIL** | `temp/` uploads never cleaned (#15); recordings retention policy not found |

---

## 4. Top 10 things most likely to break at scale

1. **Postgres saturation from chat polling** (#1, #2): a few hundred open chat tabs means hundreds of full-history queries per second.
2. **Postgres "too many connections"** from Prisma pools multiplied across serverless instances and three apps (#9).
3. **Upstash connection cap** from a new Redis connection per rate-limited request (#3), and then (because the limiter fails open, #4) no rate limiting at all.
4. **Random logouts / failed OTP verification** once any instance falls back to in-memory sessions or OTPs (#5, #6).
5. **Function pile-up when Cashfree or LiveKit is slow**, with no timeouts (#7). Payments and joins stall together.
6. **Top-of-hour class start spike:** 2 LiveKit API calls per join, plus status polling, plus a DB write per token (#28).
7. **Lost payments:** a Cashfree order without a DB row when the DB is under pressure (#10), and reconciler throughput capped at about 300 orders/h (#20).
8. **Silent failures:** without error tracking or alerts (#8), problems 1–7 are found by users, not on-call.
9. **Stale discover and dashboard data** across instances after bookings (#26), and discover slowing as reviews accumulate (#25).
10. **Uploads > 4.5 MB failing** with a platform 413, and uploads vanishing if `STORAGE_PROVIDER` is unset (#29, #30).

---

## 5. Launch blockers vs post-launch

### Must fix before launch
- #1, #2: paginate chat, add `(senderId, receiverId, createdAt)` indexes, slow the polling.
- #3, #4, #5, #6: one shared Redis client (or the Upstash HTTP SDK), no in-memory fallbacks in production, fail closed on auth limits.
- #7: timeouts on every outbound call.
- #8: Sentry (or similar) and alerts on 5xx, latency, DB/Redis errors and cron failure.
- #9: set `connection_limit` and confirm Supabase pooler sizing (check the production env values).
- #10: write `PaymentOrder` before calling Cashfree.
- #11, #12: revoke the leaked LiveKit key; resolve the private-key finding; gitleaks on every PR.
- #13, #14, #15: real deletion and erasure, chat retention job, private document storage. These are legal exposure as well as engineering issues.
- #16: patch nodemailer and axios (high, production deps).
- #21: confirm a reconcile scheduler is actually running in production.

### Soon after launch (first 2–4 weeks)
- #17, #18, #19, #35: CSP on student-web, Origin check, create-order limit, per-account login limit.
- #20, #22, #23, #24, #25, #26: cron lock, missing indexes, pagination everywhere, review aggregates, shared cache.
- #27, #28: a queue with retries and DLQ; pre-create LiveKit rooms.
- #29–#34: presigned uploads, storage/env validation, safe migration process, remove duplicate APIs and the duplicate mobile booking path.
- Run the k6 scripts in `audit/load-tests/` against staging and record the baselines.

### Backlog
- #36–#41, feature flags, data export, `global-error.tsx`, admin health endpoint, a restore drill for Supabase backups.

---

## 6. Load tests (Step 3)

Created in `audit/load-tests/` (k6): `01-login.js`, `02-discover-list.js`, `03-book-class.js`, `04-payment-create-order.js`, `05-live-class-join.js`, shared `lib/common.js`, and `README.md`. Each has ramp-up, steady (10 min) and 5x spike stages. `lib/common.js` refuses the known production hosts and requires `I_CONFIRM_NOT_PRODUCTION=yes`. The payment script also requires `CASHFREE_SANDBOX_CONFIRMED=yes`.
**Not run.** k6 isn't installed on this machine, and you haven't confirmed a target. The scripts passed a JavaScript syntax check only (`node --check`).

---

## 7. Files read, and what was NOT checked

### Commands run (real output summarised above)
- `npm run typecheck` → EXIT 0 · `npm test` → EXIT 0, 401 tests passed · `npm run lint` → EXIT 0
- `npm audit --omit=dev` → 26 vulns (19 high, 7 moderate) · `npm audit` → 33 vulns (26 high, 7 moderate)
- `npm run test:payments` → 1 failed / 180 passed / 2 skipped
- Full-history secret scan: `gitleaks` and `trufflehog` **not installed**. I used a custom regex scan over `git log --all -p` (all 715 commits, every branch, excluding `package-lock.json`, PDFs as binary). The first attempt was broken (pathspec typo and a PDF textconv error) and I re-ran it. 32 unique hits were triaged; every value was masked and none was printed.
- A script listing every `findMany` without `take` (for #24): the main ones are cited in #24, and the rest are in the same apps' `features/*/services` and admin `(dashboard)` pages.

### Files opened and read
`README.md`, `package.json`, `vercel.json`, `.env.example` (values masked), `.env` (key names only; DB/Redis URL host and params masked), `.gitignore` (line 23), `docs/architecture.md`, `docs/runbook.md`, `packages/database/prisma/schema.prisma` (full), migrations `20261019000000_*`, `20261019000100_*` (full), index lines of `20260925000000_*` and `20260926120000_*`, `packages/database/src/index.ts`, `packages/auth/src/redis-session.ts`, `packages/auth/src/index.ts`, `packages/live-classes/src/cashfree.ts`, `payment-reconciliation.ts`, `coin-payments.ts` (60-92), `handlers.ts` (25-200), `usage.ts` (20-90, 189-204), `booking.ts` (188-196, 280-340), `packages/livekit/src/server.ts` (171-196), `packages/currency/src/index.ts` (50-110), `apps/student-web/src/lib/{db,redis-client,rate-limit,redis-session,api-cache,idempotency,auth,auth-mobile(1-60),discover-query}.ts`, `apps/student-web/src/proxy.ts`, `apps/student-web/next.config.ts`, `apps/student-web/src/lib/tokens.ts` (cookie options), student-web routes `api/auth/login` (1-60), `api/students/discover`, `api/students/chat` (1-80), `api/students/chat/[teacherId]` (55-90), `api/students/profile/request-deletion`, `api/students/teacher/[id]/book` (55-70), `api/payments/create-order`, `api/live/token` (1-50), `api/v1/bookings` (60-200), `api/cron/reconcile-payments`, `api/cron/reconcile-sessions`, `api/health`, `api/webhooks/cashfree`, `apps/teacher-web/src/lib/{storage(1-260),memory-otp-store,redis-client}.ts`, `apps/teacher-web/src/proxy.ts` (1-230), `apps/teacher-web/next.config.ts`, teacher-web routes `api/auth/login`, `api/auth/upload`, `api/auth/send-registration-otp`, `verify-registration-otp` (40-70), `register/teacher` (55-75), `register/student` (84-100), `forgot-password/send-otp` (grep), `api/health`, `api/monitoring` (1-40), `apps/admin-panel/src/proxy.ts`, `apps/admin-panel/next.config.ts`, `apps/admin-panel/src/lib/rate-limit.ts` (95-150), admin routes `live/costs`, `payments/[orderId]/refund`, `teachers/[id]/status`, `payouts/[id]` (first 30-40 lines), all `.github/workflows/*.yml`.

### NOT checked / NOT VERIFIED
- **Production configuration:** Vercel env vars, `connection_limit`, Supabase plan and pooler limits, Upstash plan limits, whether Vercel crons are registered, custom domains, uptime monitors. No access.
- **Backups:** Supabase backup/PITR settings, encryption, and any restore drill.
- **Repo visibility** on GitHub (public or private), which changes the severity of #11. No `gh` CLI.
- Whether the leaked LiveKit key (#11) is still active.
- **Runtime behaviour:** no server was started, no k6 runs, no `next build` (so bundle sizes are unknown), no e2e (Playwright), no Python security suite (`tests/security`).
- `apps/student-mobile` beyond its API client timeout (`src/lib/api-client.ts:81-92`), which is good: 15 s timeouts.
- Full bodies of `packages/live-classes/src/{settlement,webhook,access,recording,payment-refunds,payment-webhooks,recording-payments,monitoring}.ts` and `packages/database/src/coin-ledger.ts` (only grep or partial reads). Money correctness there is covered by an earlier audit (`audit/PAYMENT_AUDIT.md`, not re-verified).
- Admin-panel RBAC (`lib/api-auth.ts`, `permissions.ts`, `totp.ts`), only confirmed to be called on every admin route.
- Every remaining route body. The auth-coverage check was a grep for guard calls across all 133 route files, plus manual reads of the ones that didn't match.
- SQL injection review of all `$queryRaw`/`$executeRaw` (the ones read use tagged templates, which are parameterised).
- RLS policies in Supabase (schema comments mention RLS; the app connects with a role that bypasses them; not checked).
- Email deliverability and Resend/Zoho quotas; Cashfree and LiveKit account rate limits.

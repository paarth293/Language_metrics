# Fix batch: Redis + rate limits (#3, #4, #5, #6)

Source of truth: `audit/PRODUCTION_READINESS.md`. Branch `fix/redis-rate-limits`, cut from `Priyanshu` @ `b9e2d2f`. 17 commits: 16 one-per-file commits for #3–#6, plus `23196e8` for the follow-up below. **Not pushed.** Date 2026-10-19.

Every fix changes production behaviour only (`NODE_ENV === "production"`), except #3 and #4, which have no dev-only path (dev without `REDIS_URL` already used the in-process limiter and still does).

## Baseline before the batch

| Check | Result |
|---|---|
| `npm run typecheck` | EXIT 0 |
| `npm run lint` | EXIT 0 |
| `npm test` | EXIT 0, 401 passed |
| `npm run test:payments` | EXIT 1: **1 failed** / 180 passed / 2 skipped. The failure is `09-secret-scan.test.ts > no private key material anywhere in git history` (#12, out of scope). It's unchanged after every fix below. |

## Issues fixed

### #3: a new Redis connection on every rate-limit call (decision: option A, one shared ioredis client)

Files: `apps/student-web/src/lib/rate-limit.ts`, `apps/teacher-web/src/lib/rate-limit.ts` (identical). Test: `src/lib/rate-limit.redis.test.ts` in both apps.

- `rateLimitRedis()` now reuses one module-level client, created on first use and recreated only if it reaches `end`. No more `quit()` per call.
- The shared client reconnects with a backoff capped at 2 s. The old `retryStrategy: () => null` was only safe because every client was thrown away.

Before the fix (both apps):
```
FAIL  src/lib/rate-limit.redis.test.ts > rateLimitRedis connection reuse > creates one Redis client for many calls instead of one per call
AssertionError: expected 5 to be 1 // Object.is equality
```
After the fix: `Test Files 1 passed (1)  Tests 1 passed (1)` in student-web; `Test Files 2 passed (2)  Tests 12 passed (12)` in teacher-web (with the existing `rate-limit.test.ts`).

### #4: the rate limiter fails open on Redis errors (decision: option A, in-process fallback)

Same two files. Test: `src/lib/rate-limit.redis-failure.test.ts` in both apps.

- The `catch` block now returns `rateLimit(namespace:identifier, …)`, the in-process limiter, instead of `false`. During a Redis outage the limit is enforced per instance.

Before the fix (both apps):
```
❯ src/lib/rate-limit.redis-failure.test.ts (1 test | 1 failed)
AssertionError: expected false to be true // Object.is equality
❯ src/lib/rate-limit.redis-failure.test.ts:44:60        (3rd request with max: 2 was allowed)
```
After the fix: student-web `Test Files 2 passed (2) Tests 2 passed (2)`; teacher-web `Test Files 3 passed (3) Tests 13 passed (13)`.

### #5: refresh sessions fall back to per-instance memory

Files: `apps/student-web/src/lib/redis-session.ts`, `apps/teacher-web/src/lib/redis-session.ts`. Test: `src/lib/redis-session.fallback.test.ts` in both apps.

In production:
- A missing `REDIS_URL` or a failed Redis operation throws `SessionStoreUnavailableError` ("Redis session store unavailable"). There's no in-memory fallback.
- `_redisAvailable` no longer latches `false`, and the client keeps reconnecting (backoff capped at 2 s).
- `connect()` is called only from the initial `wait` state. Concurrent cold-start requests otherwise hit ioredis's "already connecting" error.

Development: unchanged (in-memory fallback, latching, stops retrying after 2).

Before the fix (both apps):
```
× in production, refuses to store sessions in instance memory and goes back to Redis once it recovers
AssertionError: promise resolved "undefined" instead of rejecting
Tests  1 failed | 1 passed (2)
```
The cold-start guard was proven by temporarily restoring the old `connect()` condition:
```
× in production, concurrent first calls on a cold start both reach Redis
AssertionError: promise rejected "SessionStoreUnavailableError: Redis sessi…" instead of resolving
Caused by: Error: Redis is already connecting/connected
Tests  1 failed | 2 passed (3)
```
After the fix (guard restored): `Tests 3 passed (3)` in both apps.

### #6: teacher-web's `getRedisClient()` returns `null` on a cold start, and the OTP falls back to memory

Files: `apps/teacher-web/src/lib/redis-client.ts`, `apps/teacher-web/src/lib/memory-otp-store.ts`. Tests: `src/lib/redis-client.test.ts`, `src/lib/memory-otp-store.test.ts`.

In production:
- `getRedisClient()` returns the client from the first call. ioredis queues commands until it's connected. A failed connect no longer drops the client, and it keeps reconnecting (backoff capped at 2 s).
- `memoryOtpStore.setHash()` throws, so send-registration-otp returns its existing 500 before emailing a code that could never verify. `getHash` and `isVerified` return nothing, and the setters are no-ops.

Development: unchanged (`null` until the connection is confirmed; memory store works). No route files were changed; the 10 callers keep their `Redis | null` signature.

Before the fix:
```
× in production, refuses to hold OTPs in instance memory
× in production, returns a client on the very first call of a cold start
× in production, keeps returning the client after a failed connect so it can reconnect
AssertionError: expected [Function] to throw an error
AssertionError: expected null not to be null
AssertionError: expected null not to be null
Tests  3 failed | 2 passed (5)
```
After the fix: `Tests 5 passed (5)`.

### Follow-up: the registration-code route skipped its rate limit on Redis errors, plus #39 prune (commit `23196e8`)

Files: `apps/teacher-web/src/app/api/auth/send-registration-otp/route.ts`, `apps/teacher-web/src/lib/rate-limit.ts`, `apps/student-web/src/lib/rate-limit.ts`. Test: `apps/teacher-web/src/app/api/auth/send-registration-otp/route.test.ts`.

- When a Redis command in the route's rate-limit block throws, the route now applies the **same limits** with the in-process limiter: 60 s cooldown (1 per email) and 5 per hour per email. Before, it continued with no limit. The request is neither skipped nor blocked outright.
- `rateLimit()` (the in-process limiter) now prunes expired entries once its `Map` passes 1,000 keys (#39). Both `rate-limit.ts` copies were changed so they stay identical.
- Untouched: the `else` branch (Redis client is `null`, which after #6 happens in production only when `REDIS_URL` is unset), and status codes (500 stays 500).

The test mocks every Redis command to throw and calls the route 3 times for one email. The spec asked for "max 2, 3rd call blocked". The route has no configurable max, so the test keeps the route's real limits and asserts the 3rd call returns 429.

Before the fix:
```
statuses: [ 500, 500, 500 ]
× still rate-limits with the in-process fallback instead of skipping the limit
AssertionError: expected 500 to be 429 // Object.is equality
Tests  1 failed (1)
```
After the fix:
```
statuses: [ 500, 429, 429 ]
✓ ... > still rate-limits with the in-process fallback instead of skipping the limit
Tests  1 passed (1)
```
The 500s come from the next step: with Redis down, storing the OTP hash fails (existing behaviour, not changed), so no email is sent. The 2nd call is already blocked because the cooldown allows 1 per 60 s. Not unit-tested: the prune itself (the `Map` isn't exported). The existing in-process limiter tests still pass.

Gate after this change:
```
typecheck EXIT 0
lint EXIT 0
test EXIT 0      teacher-web 152 passed (+1); all other workspaces unchanged; 417 passed total
test:payments EXIT 1
 FAIL  tests/payment-security/09-secret-scan.test.ts > ... no private key material anywhere in git history
      Tests  1 failed | 180 passed | 2 skipped (183)
```
Only the known #12 failure and the 2 skips.

### Full gate after the last fix of #3–#6 (real output)

```
typecheck EXIT 0
lint EXIT 0
test EXIT 0
      Tests  32 passed (32)      admin-panel
      Tests  116 passed (116)    student-web   (+5 new)
      Tests  151 passed (151)    teacher-web   (+10 new)
      Tests  6 passed (6)
      Tests  13 passed (13)
      Tests  4 passed (4)
      Tests  46 passed (46)
      Tests  44 passed (44)
      Tests  4 passed (4)
test:payments EXIT 1
 FAIL  tests/payment-security/09-secret-scan.test.ts > 9. secret scan > git history > no private key material anywhere in git history
      Tests  1 failed | 180 passed | 2 skipped (183)
```
`npm test`: 416 passed / 0 failed (baseline 401 + 15 new). The `test:payments` failure is the pre-existing #12, identical to the baseline.
The same gate was run after each of #3, #4 and #5, with the same results apart from the growing count of new tests.

## Behaviour change to expect in production

While Redis is unreachable:
- **Login:** teacher-web returns **503** (its catch already maps "Redis" errors, `apps/teacher-web/src/app/api/auth/login/route.ts:103`). student-web login returns its generic **500**.
- **Token refresh** (`teacher-web /api/auth/refresh`, `/api/auth/silent-refresh`, `student-web /api/v1/auth/mobile/refresh`): **500**. Users stay logged out until Redis recovers.
- **Logout:** no change (already `.catch(() => {})`).
- **Registration and OTP routes:** their existing 400/500 errors, instead of codes that only verify on the same instance.
- **Rate limits:** enforced per instance (in-process) instead of not at all.

## Still open (not done in this batch, and why)

| Item | Why open |
|---|---|
| ~~send-registration-otp skips its rate limit when a Redis command throws~~ | **Fixed** in `23196e8` (see the follow-up above). |
| ~~#39: the in-process limiter `Map` is never pruned~~ | **Fixed** in `23196e8` (prune expired entries past 1,000 keys). |
| Refresh routes and student-web login return 500, not 503, on `SessionStoreUnavailableError` | You asked not to change this yet. |
| Other teacher-web OTP routes (`send-otp`, `verify-otp`, `forgot-password/*`) have their own Redis try/catch blocks | Not examined for the same fail-open pattern in this change (out of the stated scope). NOT VERIFIED. |
| #40: `packages/auth/src/redis-session.ts` rotation pipeline | Out of scope (Low). Not used by the app routes, which import their local `@/lib/redis-session`. |
| `apps/admin-panel/src/lib/rate-limit.ts` Redis client uses `retryStrategy: () => null` | Not part of #3–#6 (the admin client is already a singleton). Once disconnected, it may stay ended; NOT VERIFIED. Raise it if you want it in a later batch. |
| `apps/student-web/src/lib/redis-client.ts` (health, idempotency) | Not in scope. It already returns its client from the first call. |

## Migrations waiting to be applied

None. This batch changed no schema.

## Env vars to set in Vercel

- **`REDIS_URL` is now required** on the **student-web** and **teacher-web** projects for **Production and Preview**. Vercel builds Preview deployments with `NODE_ENV=production`, so a preview without `REDIS_URL` will now reject login, refresh and registration OTPs instead of quietly using memory.
- No new variables. Option A kept ioredis, so no Upstash REST URL or token is needed.

## NOT VERIFIED

- Behaviour against a **real** Redis/Upstash. All proof tests mock `ioredis`. Not checked: real reconnect timing, the offline queue under a real outage, and Upstash's connection count after #3 (should drop to about one per warm instance per module).
- That Vercel Preview builds really run with `NODE_ENV=production` for this project (it's Vercel's default; the project settings weren't checked).
- No server was started, and the k6 load tests were not run.
- The branch is **not pushed** and no PR is open. `audit/PRODUCTION_READINESS.md`, `audit/load-tests/` and this file are **uncommitted**.

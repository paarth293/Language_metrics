# Progress: reliability batch

Branch `fix/reliability` (from `fix/chat-security` @ `6d0dca0`). Plan: `audit/PLAN_reliability.md`. Not pushed.

"go" received. I applied the plan's proposals as the answers to questions 1–3 and 5–9:
- #8 split into 8a–8f;
- request ID from `x-request-id` / `x-vercel-id` / new UUID;
- Sentry added only when a DSN is set;
- sweep marks 404'd orders `EXPIRED`;
- `pg_try_advisory_xact_lock`;
- teacher-web cron → 410 (**you must point the `APP_URL` repo secret at student-web**);
- moved `vercel.json` carries `crons` only;
- env groups all-or-nothing.

Question 4 (recording flow) and **#10 itself still need a separate "go"**.

Baseline @ `6d0dca0`: typecheck 0, lint 0, `npm test` 569 passed, `test:payments` 1 failed (#12) / 180 passed / 2 skipped.

| Issue | Status | Commit | Notes |
|---|---|---|---|
| #7 timeouts | DONE | `d244231` | `npm test` 587 passed. LiveKit already had a 10 s SDK default (now 8 s, pinned, clear error). S3 needed `throwOnRequestTimeout` + `maxAttempts: 1`. `packages/auth` oauth/email changed but untested: no test runner, and nothing imports them. |
| #20 cron safety | DONE | `d1b58f4` | `npm test` 593, `test:payments` 187 passed + #12 + 2 skips. **Changed from plan answer 6:** the lock is a session `pg_try_advisory_lock` on a dedicated one-connection client (`DIRECT_URL`, else `DATABASE_URL`), not a transaction lock. The transaction lock holds a pool connection for the whole sweep, and with `connection_limit=1` (Supabase's serverless advice) the sweep's own queries would wait behind it until the pool timed out. `06-reconciliation` now uses student-web's route (teacher-web is 410). Real Postgres lock NOT VERIFIED. |
| #21 vercel.json (code part) | DONE (code part) | `4ce6b0f` | `git mv` to `apps/student-web/vercel.json`, crons only (no `regions`). Dashboard checks are listed for the report; not verified against Vercel. |
| #31 env validation | DONE | `9f04d19` | `npm test` 626. Real `next build` + `next start` of student-web: with `CRON_SECRET=""`, Next 16.3.8 does **not** exit. It logs "Invalid environment … CRON_SECRET is required" and answers every request 500. With it set, `/api/health` → 200. A drift test fails when code reads an undocumented variable. |
| #8a Sentry | DONE | `f439798` | `npm test` 635. Only on with a DSN; scrubbed events; npm audit totals unchanged (7 moderate / 26 high, all pre-existing). Real build + boot of student-web with no DSN: `/` and `/api/health` 200. |
| #8b logger + request ID | DONE | `84a4c69` | `npm test` 651. New `@repo/logger`; teacher-web proxy forwards one ID. |
| #8c payment + webhook logs | DONE | `122881c` | |
| #8d auth + cron logs, no OTP in logs | DONE | `8818d60` | See the production-fix run below. |
| #8e–8f | see below | | |
| #10 PaymentOrder before Cashfree | waiting for separate "go" | | |
| #27, #28 | out of scope, follow-ups only | | |

## Found while working, NOT acted on (need your decision)

- teacher-web `sendVerificationEmail` / `sendPasswordResetEmail` (`apps/teacher-web/src/lib/email.ts`) ignore Resend's `{ error }` result. Resend never throws on network errors (`resend/dist/index.mjs:1309-1320`), so a failed send looks successful.
- `zoho-mailer.ts` dev fallback `console.log`s the OTP code when both providers fail, in production too. Planned fix in 8d (never log OTPs), which is within #8's scope.

---

# Production-fix run (started 2026-10-19)

Source of truth: `audit/PRODUCTION_READINESS.md` and `audit/STATUS_2026-10-19.md`. Never pushed.
Allowed check failures: `test:payments` #12 (`09-secret-scan` git-history test), plus its 2 skips.

## Branches

| Phase | Branch | Made from |
|---|---|---|
| 0 | `fix/reliability` | (existing) |
| 1 | `fix/phase1-observability` | `fix/reliability` @ `8818d60` |

## Issues

| Phase | Issue | Status | Commit | Checks after | Notes |
|---|---|---|---|---|---|
| 0 | #8d auth + cron logs; no OTP in console | DONE | `8818d60` | typecheck 0, lint 0, test 656 passed, payments 191 passed / 1 failed (#12) / 2 skipped | Added the missing `printForDevelopment` imports and replaced the last 4 `console.*` calls. `packages/auth` now depends on `@repo/logger` (lockfile edited by hand, 1 line; `npm install` offline couldn't resolve an unrelated optional package). Proof: both new tests failed at `122881c` (OTP `482913` printed by `sendVerificationOTP` / `sendPasswordResetOTP` in production; ~90 `console.*` lines in auth/cron paths) and pass now. `outbound.timeout.test.ts` updated to read the JSON log line instead of the old `console.warn(msg, err)` second argument. HEAD checked on its own: after the commit the tree equals HEAD except untracked `audit/*.md`, and all 4 checks were re-run. |
| 1 | #8 Sentry scrubbing (messages, stack, extra, contexts, breadcrumbs) | DONE | `aabce64` | typecheck 0, lint 0, test 662, payments 191/1 (#12)/2 skipped | Proof: both new tests failed first (raw `:pw@` and JWT in the sent event; no `beforeBreadcrumb`). `redactText` does not mask plain email addresses, so an email in an error message still reaches Sentry. Real Sentry ingestion NOT VERIFIED. |
| 1 | #8e ops alerts (cron, payment 5xx, DB, Redis) | DONE | `8132cb3` | typecheck 0, lint 0, test 695, payments 191/1 (#12)/2 skipped | `reportOpsAlert` + `noteServerError` + `withServerErrorAlerts` in `@repo/logger/ops-alert`; `OPS_ALERT_WEBHOOK_URL` (optional) in `.env.example` and the 3 env schemas. Proof failures shown first for: the module (missing), both cron routes (sweep error escaped unhandled, no alert), the 5 student-web payment routes (3 × 500, no alert), the DB classifier (missing), all 8 Redis handlers (patch set aside with `git diff > patch` / `git checkout` / `git apply`, not stash). teacher-web payment test was written after the wrap (same code as student-web). **Limits:** throttle and 5xx counter are per server instance, not shared across Vercel instances. The DB hook relies on Prisma emitting `error` log events for connection failures: unit-tested with the message text only, real Prisma/Postgres behaviour NOT VERIFIED. The DB and Redis alerts are fire-and-forget (event listeners), so a function that ends right after may drop the POST. Real webhook delivery NOT VERIFIED. `packages/auth` Redis client not hooked (nothing imports it). |
| 1 | #8f global-error ×3, admin error.tsx, admin `/api/health` | DONE | `7f73564` | typecheck 0, lint 0, test 715, payments 191/1 (#12)/2 skipped; `next build` admin-panel OK (lists `ƒ /api/health`) | Proof: every new test failed first (files missing). Health: `{status, services:{database,redis}}` with `up`/`down` only, 503 if either is down, 2 s probe timeout, `no-store`; public (the admin proxy matcher skips `/api`). New `pingSessionStore()` in admin `redis-session.ts`. Live probe against a real DB/Redis NOT VERIFIED (not run against the local `.env`, which may point at real services). student/teacher `error.tsx` still don't report to Sentry (not in scope). |
| 1 | #8 console.* → logger in booking, recordings, coin-balance routes | DONE | `40ff7bf` | typecheck 0, lint 0, test 715, payments 191/1 (#12)/2 skipped | Proof: the extended no-console scan failed on the 6 files first. Left as-is (not named): `students/classes/[id]/cancel` ×2 and other routes, about 120 `console.*` calls overall. |

**Phase 1 complete** (`fix/phase1-observability` @ `40ff7bf`). PR requested (base `Priyanshu`). Push attempt was blocked by this session's permission check, so the branch is still local only. PR description drafted in the session scratchpad (`PR_DESCRIPTION.md`). Next: Phase 2, starting with the `PLAN_10.md` GATE.

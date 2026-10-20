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

## CI fix (on `fix/phase1-observability`)

| Issue | Status | Commit | Notes |
|---|---|---|---|
| PR checks failing in seconds (CVE Audit, Dynamic Security Tests, Mobile CI) | DONE (locally) | `49cd365` | Cause: `npm ci` on Node 22 / npm 10 rejected the lockfile ("Missing: @emnapi/runtime@1.11.3, @emnapi/core@1.11.3"). Introduced in `f439798` (#8a, lockfile written by npm 11). `origin/Priyanshu` and `origin/main` were fine. Regenerated with `npm@10 install --package-lock-only`; npm 10 and 11 `ci --dry-run` both pass. The 4 checks were unchanged. Mobile typechecks pass locally. npm audit: 0 critical (26 high = #16). Dynamic Security Tests also need DB secrets and a dev server; they can't be checked here (NOT VERIFIED). **Not pushed: you need to push `fix/phase1-observability` again.** |

## Phase 2

| Phase | Branch | Made from |
|---|---|---|
| 2 | `fix/phase2-payments` | `fix/phase1-observability` @ `49cd365` |

| Phase | Issue | Status | Commit | Notes |
|---|---|---|---|---|
| 2 | #10 PaymentOrder row before Cashfree (coins + recordings) + reconciler 404 → EXPIRED | DONE | `d26a046` | typecheck 0, lint 0, test 715, payments 208/1 (#12)/2 skipped | "go" given without answers, so the recommendations were used: recording flow included, Option A for retries. 17 new tests in `issue-10-order-before-cashfree.test.ts`, 15 shown failing first. Real Cashfree 404 for unknown orders NOT VERIFIED (fake Cashfree only); real Postgres NOT VERIFIED. |
| 2 | #10 fix: don't expire a row whose Cashfree call may still be running (< 60 s) | DONE | `017ad50` | typecheck 0, lint 0, test 715, payments 209/1 (#12)/2 skipped | Race in the recording reuse added by `d26a046`, found while building Option A. Test failed first, passes now. |
| 2 | #10 Option A: coin retry reuses the open order for the same pack | DONE | `2b58eec` | typecheck 0, lint 0, test 715, payments 215/1 (#12)/2 skipped | First attempt undone (it broke `issue-20` ×3 and `issue-12` ×1, which bought the same pack repeatedly as one student). You chose option 1: re-applied, and those tests now use one student per order; their assertions are unchanged. 6 reuse tests (shown failing before). Same-millisecond double requests can still open 2 orders (no double charge). Covers the reuse half of #19. |

## Phase 3

| Phase | Branch | Made from |
|---|---|---|
| 3 | `fix/phase3-security` | `fix/phase2-payments` @ `2b58eec` |

| Phase | Issue | Status | Commit | Checks after | Notes |
|---|---|---|---|---|---|
| 3 | #16 nodemailer, axios, source-map-js + blocking CI audit | DONE | `f1ea409` | typecheck 0, lint 0, test 715, payments 215/1 (#12)/2 skipped; `next build` teacher-web OK; npm 10 + 11 `ci --dry-run` OK | `npm audit --omit=dev`: before 26 (7 moderate / 19 high), after 22 (7 / 15); all of the rest is student-mobile's Expo/React Native tree (**follow-up: Expo upgrade**, not done). nodemailer was a major bump 9 → 10 (only `createTransport`/`sendMail` used; SMTP timeout tests pass). CI gate = `npm run audit:web` (web apps' production tree only, high/critical). Proof: replaying the pre-fix audit blocks axios, nodemailer, source-map-js; the live audit passes. |
| 3 | #12 private-key finding + `test:payments`/gitleaks in CI | GATE: `audit/PLAN_12.md`, waiting for "go" + 2 answers | | | The finding (`159f42f`, `tokens.ts:22`, `DEV_PRIVATE_KEY`) is a malformed placeholder (219 decoded bytes vs ~1,190 for 2048-bit RSA; neither half parses). It is already in `.gitleaksignore`. `.gitleaksignore` was not touched. |
| 3 | #12 option A: `09-secret-scan` honours `.gitleaksignore`; `test:payments` in CI | DONE | `636bd2a` | typecheck 0, lint 0, test 715, **payments 217 passed / 0 failed / 2 skipped** | The first fully green run of all 4 checks. `.gitleaksignore` was not changed. |
| 3 | #12 gitleaks on every PR, full history | GATE (2nd): findings in `audit/PLAN_12.md` | | | Local gitleaks 8.21.2 (checksum verified): 19 findings, all fixtures or placeholders. **gitleaks' default rules miss the LiveKit key (#11)**, so a custom rule is proposed. Waiting on approval for the ignore entries and the key revocation. |

| 3 | #17 CSP for student-web | PARTLY (sent as **Report-Only**) | `a506163` | typecheck 0, lint 0, test 724, payments 217 passed / 0 failed / 2 skipped | New `src/csp.ts` (teacher-web's rules: Cashfree SDK/API/frames/form-action, sandbox hosts only in sandbox, LiveKit Cloud + self-hosted host), plus `frame-ancestors 'none'`, `img-src https:` (students paste any avatar URL), and the browser Sentry origin + CSP `report-uri` when `NEXT_PUBLIC_SENTRY_DSN` is set. Proof: the next.config test failed first (header `undefined`), 9/9 pass now. Real `next build` + `next start` (`.env` loading off via `__NEXT_PROCESSED_ENV`, all its keys masked or unset): the header is on `/`. **To finish:** check checkout and the classroom on a preview deploy with no violations, then change `CSP_HEADER` to `Content-Security-Policy`. Cashfree checkout, the LiveKit classroom and Sentry's CSP report endpoint under this policy NOT VERIFIED (no browser run against live services). |

| 3 | #18 Origin check on student-web cookie API routes | DONE | `4e82d4f` | typecheck 0, lint 0, test 736, payments 217 passed / 0 failed / 2 skipped | Proxy matcher `/api/v1/:path*` → `/api/:path*`. Writes (POST/PUT/PATCH/DELETE) outside `/api/v1/` and `/api/webhooks/` get 403 `{ error: "Cross-origin request rejected." }` when the Origin host ≠ Host (exact compare; malformed/`null` Origin = mismatch; Host missing → request URL host). No Origin → allowed, as in teacher-web. `/api/v1` CORS unchanged. Proof: 9 new tests failed first (cross-origin writes passed through), 19/19 pass now. That Vercel's `Host` header equals the public domain the browser uses (custom domain, preview URLs) NOT VERIFIED. |

| 3 | #19 per-user rate limit on create-order | **REVERTED — needs your decision** | — | — | 5/min per student on both apps' `/api/payments/create-order` (tests failed first, then passed), but it broke `test:payments`: **54 tests in 8 suites**. The harness sets no `REDIS_URL`, so `rateLimitRedis` falls back to the module-level in-process limiter, which persists across every test in a file; 8 suites create >5 coin orders as one student. Reverted per the global rule; all 4 checks green again. Work saved at `scratchpad/issue-19.patch` + `19-student.test.ts` / `19-teacher.test.ts`. **Option A (recommended):** mock `@/lib/rate-limit` in those 8 suites, as `issue-10-*` already do. **Option B:** one student per order across all 54 tests (risks masking #10's reuse). The reuse half of #19 is already done in `2b58eec`. |
| 3 | #38 atomic idempotency claim | DONE | `4359ead` | typecheck 0, lint 0, test 740, payments 217 / 0 / 2 skipped | `SETNX` + `EXPIRE` → one `SET key 1 EX 604800 NX` (that argument order is ioredis's typed overload; Redis treats EX/NX as flags). Also moved the no-Redis warning off `console`. Proof: 3 tests failed first. **`checkAndSetIdempotency` has no callers anywhere** — candidate for the #41-style remove-or-document pass. Real Redis NOT VERIFIED. |
| 3 | #37 reject stale Cashfree webhooks | DONE | `dba2355` | typecheck 0, lint 0, test 744, payments 217 / 0 / 2 skipped | New `webhookTimestampFresh()` in `packages/live-classes/src/cashfree.ts`, called in both apps' webhook routes **after** the signature check: >5 min old → 400. Accepts epoch seconds or ms, allows 1 min of clock skew, rejects unparsable values. `verifyCashfreeWebhook` stays signature-only so its existing tests hold. Fixtures refreshed in `route.test.ts` and both `payment-5xx-alerts.test.ts` (which mock the module, so they now also stub `webhookTimestampFresh`). The payment harness already signs with `Date.now()`, so no suite broke. Proof: 4 new helper tests + the route tests. Real Cashfree timestamp format (seconds vs ms) NOT VERIFIED. |
| 3 | #40 packages/auth refresh rotation | DONE | `e1ca356` | typecheck 0, lint 0, test 744, payments 217 / 0 / 2 skipped | Pipeline `DEL` + `SET` → `GETDEL` then conditional `SET`, matching `apps/student-web/src/lib/redis-session.ts`. The old code SET the new session whatever DEL returned, so a replayed or stolen token still minted a usable session while the function reported theft. **NOT VERIFIED: `packages/auth` has no test runner** (same as the #7 entry above) and nothing imports it. |
| 3 | #36 monitoring route auth | DONE | `00e3e43` | typecheck 0, lint 0, test 761, payments 217 / 0 / 2 skipped | `MONITORING_API_KEY` is the only way in; the `origin.includes(host)` fallback is gone. Constant-time compare over SHA-256 digests (so length never leaks), no key configured → stays closed, and DB/Redis failures log through `@repo/logger` instead of returning the driver's message. Proof: 3 of 5 tests failed first (forged Origin passed; the DB error with host and password was echoed). One test expectation of mine was wrong — HTTP strips a trailing space from a header value, so `Bearer <key> ` really is the key; replaced with prefix/extension/wrong-scheme cases. |
| 3 | #35 per-email login limit + lockout | DONE | `95f99ea` | typecheck 0, lint 0, test 761, payments 217 / 0 / 2 skipped | New `login-lockout.ts` in both apps (the repo already keeps `rate-limit.ts` / `redis-client.ts` per app): 5 **failures** per email per 15 min, admin's constants. Counts failures, not attempts, so several devices never lock a person out; the window is set on the first failure and not extended; 429 + `Retry-After` is returned **before** any DB or bcrypt work; a success clears the count. A Redis outage or a key that lost its TTL never locks anyone out. Wired into student and teacher login. Proof: 8 helper tests, plus 4 route tests shown failing with the route reverted (`git diff`/`checkout`/`apply`, not stash) and passing after. Real Redis NOT VERIFIED. |

| 3 | Chat follow-ups: "message not sent" notice + attachment links | DONE | `c5a8b5f` | typecheck 0, lint 0, test 766, payments 217 / 0 / 2 skipped | New `@repo/ui/chat-send-error` (5 tests) turns a failed send into one sentence, preferring the route's own `{ error }` for 403/400/413/429 and falling back per status. Wired into all **three** chat pages (student-web, teacher-web student + teacher — they are clones): a dismissible `role="alert"` notice above the composer, cleared on the next attempt, for both sends and uploads; the old `console.error` paths are gone. Attachments are now real links (`target="_blank" rel="noopener noreferrer"`) showing the file name instead of the raw URL as text. `@repo/ui` was already a dependency of both apps, so no lockfile change. The 14 existing chat polling tests still pass. Not checked in a browser (NOT VERIFIED); attachment URLs stay public until #15. |

Gate for #12 (gitleaks job) raised again on 2026-10-20; still waiting for "go" and the LiveKit revocation answer.
**Phase 3 is otherwise complete.** Remaining: the #12 gate and #19 (decision above). Phases 4–6 not started.
`audit/open-prs.ps1` (untracked) pushes the phase branch chain and prints the PR links; phases 1 and 2 are already on origin, phase 3 is 6 commits ahead.

---

# Cancel Refunds Batch (Task A)

Branch: `fix/cancel-refunds`, made from `fix/cancel-window` @ `2657f1a`.

| Issue | Status | Commit | Checks after | Notes |
|---|---|---|---|---|
| Admin cancel refund (`refundSessionHold`) | DONE | `d5cfa8b` (impl), `195550b` (test) | typecheck 0, lint 0, test passed, payments passed | Releases student coin hold via `refundSessionHold` in same transaction as status update. Idempotent on repeat clicks. Not blocked by 4h cancel window. |
| Invariant tests for `refundSessionHold` | DONE | `0a1e1c7` | typecheck 0, lint 0, test passed, payments passed | Unit tests verifying held coins return to spendable balance and `SessionBilling` status becomes `REFUNDED`. |
| Teacher cancel endpoint & security | DONE | `5bf6b71` (impl), `e2f8ac3` (test) | typecheck 0, lint 0, test passed, payments passed | `POST /api/teachers/sessions/[id]/cancel`: teacher auth, ownership check, not blocked by 4h window, releases hold, notifies student, logs with `@repo/logger` (no PII). 23 route tests. |
| Confirm dialog & button UI | DONE | `4d17c0f` (impl), `c6ef197` (test) | typecheck 0, lint 0, test passed, payments passed | `CancelClassButton.tsx`: modal with student name, start time, refund disclosure, busy state disabling, error banner. 17 tests. |
| Affordance wiring & schedule integration | DONE | `b9b6d52` (impl), `fc21687` (test) | typecheck 0, lint 0, test passed, payments passed | `SessionRow`, `ListView`, `ScheduleSidebar`, and `page.tsx` wired to `onCancelled` callback. Refetches week on cancel and shows toast. |


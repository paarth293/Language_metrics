You are continuing the production-readiness fixes for this monorepo. Before doing
anything, read these files in this order:
1. /audit/PROGRESS.md: what is done, with commit hashes and test counts. The "Production-fix run" section is the current one.
2. /audit/PRODUCTION_READINESS.md and /audit/STATUS_2026-10-19.md: the source of truth for the 41 issues.
3. /audit/PLAN_10.md and /audit/PLAN_12.md: the approved plans, and the open gate in PLAN_12.
Do not invent new issues. If you suspect one, tell me and ask first.

WHERE WE ARE (verify with git; don't trust this summary blindly)
- Branch chain (each made from the one before): fix/redis-rate-limits → fix/chat-load
  → fix/chat-security → fix/reliability → fix/phase1-observability (pushed, PR open
  against Priyanshu) → fix/phase2-payments (local) → fix/phase3-security (local, current).
- Done: #1–#8, #10 (incl. option A retry reuse), #16, #20, #31, #39; #12 option A
  (test:payments green and in CI). Partly done: #12 (gitleaks-on-every-PR job), #19 (reuse half
  done, rate limit not), #21 (dashboard), #23, #30.
- Last known checks (all 4 green): typecheck 0, lint 0, npm test 715 passed,
  test:payments 217 passed / 0 failed / 2 skipped.

GLOBAL RULES
- Continue on fix/phase3-security. Make one new branch per later phase, each made from the
  one before (fix/phase4-data, fix/phase5-db, fix/phase6-cleanup).
- Keep /audit/PROGRESS.md up to date after EVERY issue: DONE / PARTLY / SKIPPED
  + commit hash + test counts + NOT VERIFIED notes. If I say "continue", read it and resume.
- One small commit per issue. Proof test first: show the real failure, then the fix,
  then the real pass. Never say "passed" without running it.
- After every issue run: npm run typecheck, npm run lint, npm test, npm run test:payments.
  **All four must pass now** (only the 2 known skips in test:payments). Any failure: undo
  that issue and tell me, with 2 options and your recommendation.
- Never push (it's blocked in this environment anyway; I push myself). Never rewrite git
  history. Never touch production keys, production data or live Cashfree/LiveKit.
  Don't start the apps against the local .env (it may point at real services).
- Migrations: write files only, never apply. One change per file, CONCURRENTLY or
  NOT VALID where needed, plus a rollback.sql.
- Keep response shapes backward compatible, or change page and route together in one commit.
- Anything you can't test for real (Redis, Postgres, Cashfree, Sentry, Vercel) is
  marked NOT VERIFIED.
- Don't refactor outside the scope. Don't change the teacher-web marketing homepage.
- HARD GATES: at every "GATE", write /audit/PLAN_<name>.md, STOP, and wait for my
  "go". If a decision is needed, give 2 options and your recommendation. If I say just "go",
  use your recommendations.

LESSONS FROM THE LAST SESSION (follow these)
- CI uses Node 22 / npm 10. Any lockfile change must be made or checked with npm 10:
  `npx -y npm@10 install --package-lock-only --ignore-scripts` and then
  `npx -y npm@10 ci --dry-run --ignore-scripts` (it must not say "Missing ... from lock
  file"). Also check that `npm ci --dry-run` (npm 11) passes.
- A new workspace dependency (e.g. @repo/logger) must be added to that package's
  package.json AND to its entry in package-lock.json.
- The repo's ESLint no-secrets rule flags fake JWTs and DB URLs in tests. Build fixtures at
  runtime (e.g. ["eyJ...", "...", "..."].join(".")).
- gitleaks also flags test fixtures in history. Don't add new literal
  "postgresql://user:pass@host" or "-----BEGIN PRIVATE KEY-----" strings in tests; build them
  at runtime.
- Payment tests: one student per order when you need several distinct orders (a retry by
  the same student reuses the open order for the same pack, #10).
- To show the pre-fix failure, don't use git stash. Use `git diff > patch` +
  `git checkout -- files`, run the test, then `git apply patch`; or use a temporary
  `git worktree` inside the repo and remove it after.
- Write multi-line edits as Python script files with raw strings, not inline heredocs
  (inline escaping broke twice).
- Next 16.3.8 error boundaries take { error, reset }. Admin-panel tests default to
  jsdom; route tests need `// @vitest-environment node`.

WORK LEFT, IN ORDER

PHASE 3 (finish on fix/phase3-security)
- #12 gitleaks: the GATE is open in /audit/PLAN_12.md (19 fixture/placeholder findings,
  plus a custom LiveKit rule because the default rules miss #11). Ask me for "go" and whether
  I have revoked the LiveKit key, before touching .gitleaksignore. To re-run locally, use
  gitleaks 8.21.2 (checksum-verified release) with
  --log-opts="--all --no-textconv --no-ext-diff" --redact.
- #17: CSP for student-web (copy teacher-web's builder; allow Cashfree and LiveKit). Start
  in Report-Only if unsure.
- #18: Origin/Host check on mutating cookie routes in the student-web proxy.
- #19: per-user rate limit on create-order (the reuse half is already done in #10).
- #35: per-email login limit and temporary lockout for student and teacher login
  (copy admin's approach).
- #36: the monitoring route requires MONITORING_API_KEY only, constant-time compare, no raw DB errors.
- #37: reject Cashfree webhooks older than 5 minutes.
- #38: idempotency uses SET key 1 NX EX.
- #40: fix packages/auth rotation (GETDEL then conditional SET).
- Chat follow-ups: a "message not sent" notice with the reason on 403/400/413/429 in both
  chat pages; attachments shown as links.

PHASE 4: compliance and data (branch fix/phase4-data). LAUNCH BLOCKERS.
GATE for each of #13, #15 and the chat-attachment access change: write the plan, STOP, wait.
- #13: an erasure job that anonymises PII and keeps financial rows; an admin queue for deletion
  requests (students and teachers); a data-export endpoint.
- #14: a daily cron deleting ChatMessage rows past autoDeleteAt in small batches
  (CRON_SECRET, withCronLock advisory lock, maxDuration = 60, sweepInBatches; student-web
  only; reportOpsAlert on failure, like reconcile-payments).
- #15: a private bucket + short-lived signed URLs for teacher documents, a registration token
  required for uploads, a cleanup rule for temp/. Chat attachments get signed URLs too.
  Old files must keep working until migrated (describe the plan).

PHASE 5: database and performance (branch fix/phase5-db)
- #22: PaymentOrder indexes (status+createdAt, status+updatedAt).
- #23 remaining: FK indexes (Payout.teacherId, TeacherDocument.teacherId,
  Interview.teacherId, Payment.userId, Review.studentId, DeviceToken.userId,
  Complaint.studentId) and AdminAuditLog. All as migrations, one per file,
  CONCURRENTLY, with rollback.sql (copy the 20261020000000_* chat-index pattern).
- #24: take + cursor on the list endpoints and admin tables named in the report.
- #25: replace the per-review scan in discover with an aggregate.
- #26: move hot-read caching to Redis (or revalidateTag) with shared invalidation.
- #29: presigned direct-to-storage uploads; reject early on content-length.
- #30: throw at startup if STORAGE_PROVIDER is unset in production; reuse one S3 client
  per module.
- #32: a CI job that runs prisma migrate deploy against staging first (I provide the
  secrets), pin prisma in the build script, and write MIGRATIONS.md (order, backup, direct
  connection on port 5432). Never pass DATABASE_URL/DIRECT_URL as a shadow DB.
- #9: connection_limit guidance in .env.example and the README.

PHASE 6: cleanup (branch fix/phase6-cleanup)
- #28: pre-create LiveKit rooms (cron at T-5 min) or cache "room ensured" in Redis;
  treat "already exists" as success.
- #34: the mobile bookings route calls bookClass().
- #41: remove or document the unused device-token code.
- Redis-down routes return 503, not 500.
- Remaining console.* calls (about 120, e.g. the students/classes/[id]/cancel routes) →
  @repo/logger, extending packages/logger/src/no-console.test.ts.
- #27 and #33: PLAN ONLY (2 options + recommendation). Don't build.

FINISH
1. Run all four checks one last time and show the real output.
2. Write /audit/PRODUCTION_FIX_SUMMARY.md with:
   - every issue DONE / PARTLY / OPEN with commit hashes;
   - all migrations in the order to apply;
   - all env vars to set in Vercel (names only, per app);
   - the merge order of the branches;
   - a launch checklist;
   - everything NOT VERIFIED.
3. Don't give yourself a readiness score. I'll run a fresh read-only audit.
Then STOP.

Start now: read /audit/PROGRESS.md, confirm the branch and that all 4 checks pass, then
take the #12 gitleaks GATE to me (ask: "go" for the 19 ignore entries + LiveKit rule, and
whether the LiveKit key is revoked). While you wait, continue with #17.

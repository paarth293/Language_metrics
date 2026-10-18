# Payment Fix Summary — Language Metrics (Cashfree)

- **Date:** 2026-10-19
- **Branch / last commit:** `Priyanshu` @ `af4c012` (pushed; one commit per file)
- **Source of truth:** `audit/PAYMENT_AUDIT.md`. Issues are numbered as in its §3.2 table.
- **Gateway:** Cashfree PG, test mode only. No live key was used by any test or command. The suite runs against a fake Cashfree sandbox and an in-memory database (`tests/payment-security/harness/`).
- **Order followed:** the audit lists no Critical issues. High #1–#4 were fixed first, then Medium #5–#12. Low/Info #13–#18 were not in scope.

---

## 1. Issues fixed

| # | Sev | Issue | What changed | Proving test |
|---|---|---|---|---|
| 1 | High | No reconciliation; a missed webhook meant money taken and nothing credited | `reconcilePaymentOrders()` (`packages/live-classes/src/payment-reconciliation.ts`) settles, expires or reports open orders. `GET /api/cron/reconcile-payments` in student-web and teacher-web is guarded by `CRON_SECRET`. A GitHub Actions trigger runs every 10 minutes (`.github/workflows/reconcile-payments.yml`), with a daily fallback in `vercel.json`. Coin settlement moved to `packages/live-classes/src/coin-payments.ts` so both apps can reconcile. | `06-reconciliation.test.ts` |
| 2 | High | One recording could be charged twice | The open order is reused (asking Cashfree for its state). The unlock is a conditional `isRecordingPaid=false → true`; a second paid order becomes `DUPLICATE`, with no second unlock or fee row, and is alerted for refund. | `issue-02-recording-double-charge.test.ts` |
| 3 | High | teacher-web CSP blocked the Cashfree SDK | Cashfree origins added to `script-src`, `connect-src` and `frame-src` only (`apps/teacher-web/next.config.ts`). The origins come from the cashfree-js README's CSP section. | `issue-03-checkout-csp.test.ts` |
| 4 | High | `next` in a range npm audit flags high | `next` is 16.3.8 in all four manifests and the lockfile. `@emnapi/*` lock entries were kept, as in commit 76a4393. `npm ci --dry-run` passes, and npm audit no longer lists `next`. | `issue-04-next-advisories.test.ts` |
| 5 | Medium | Paid-but-unsettleable webhooks returned 4xx and were dropped | A permanent failure parks the order at `NEEDS_REVIEW`, raises an incident and returns 200. Transient failures still return 5xx so Cashfree retries. Reconciliation does the same. | `issue-05-webhook-dead-letter.test.ts` |
| 6 | Medium | Failed, refund and dispute webhooks ignored | `parseCashfreeWebhook()` + `handleCashfreeWebhook()`: failed and user-dropped attempts mark the order `FAILED` (it stays payable). A refund `SUCCESS` marks it `REFUNDED`, or completes our own refund. A cancelled refund and `DISPUTE_*` events are alerted (a dispute alert includes its respond-by date). | `issue-06-webhook-events.test.ts` |
| 7 | Medium | Coin purchases left no `Payment` row | Settlement writes `Payment{COIN_PURCHASE, SUCCESS, paise, gatewayOrderId, gatewayPaymentId}` in the same transaction, once. | `issue-07-coin-payment-record.test.ts` |
| 8 | Medium | No state machine | `packages/live-classes/src/payment-order-status.ts` has 8 statuses, a transition table and `transitionOrder()`; every status write uses it. This also closed a real bug: a REFUNDED order could be fulfilled again by a verify call (Cashfree keeps listing the refunded payment as SUCCESS). DB enforcement uses a **CHECK constraint** migration (see §4). | `issue-08-order-state-machine.test.ts` |
| 9 | Medium | No refund path | Admin-only `POST /api/admin/payments/[orderId]/refund` (`payments:refund` permission, zod validation, audit-logged), backed by `refundPaymentOrder()`. It claims the order, calls Cashfree with a deterministic `refund_id`, then reverses coins or re-locks the recording. One refund per order. Completed by the webhook or by reconciliation. | `08-refunds.test.ts` |
| 10 | Medium | Deleting a user cascaded away payment records | `PaymentOrder.user` and `CoinTransaction.user` are now `onDelete: Restrict`, with a migration generated offline (see §4). | `issue-10-no-cascade-delete.test.ts` (static check of schema and migration) |
| 12 | Medium | No alerts or retries | `reportPaymentIncident()` logs and POSTs to the optional `PAYMENT_ALERT_WEBHOOK_URL` (Slack/Discord JSON, 5 s timeout, never throws). Wired into unsettleable payments, duplicates, stuck orders (alerted once), reconciliation failures, cancelled refunds and disputes. Cashfree **reads** retry once on a network error or 5xx; order and refund creation are not retried. New Cashfree orders expire after 30 minutes (Cashfree's default is 30 days), so abandoned checkouts don't stay "stuck". | `issue-12-alerts-and-retries.test.ts` |

Core tests from your list, in `tests/payment-security/`:

| # | Core test | File | Result |
|---|---|---|---|
| 1 | Tampered amount rejected | `01-tampered-amount.test.ts` | PASS |
| 2 | Fake success callback rejected | `02-fake-callback.test.ts` | PASS. Cashfree's modal returns no client signature, so a "fake callback" is any verify call that Cashfree does not back up. |
| 3 | Invalid, replayed and duplicate webhooks | `03-webhooks.test.ts` | PASS. A replayed webhook is harmless because settlement is idempotent; the timestamp window itself (#16) is still open. |
| 4 | Callback + webhook + 20 parallel verifies = once | `04-race.test.ts` | PASS, including a harness self-check that shows a naive implementation **does** double-credit. |
| 5 | IDOR | `05-idor.test.ts` | PASS |
| 6 | Success but webhook missed → reconciliation fixes it | `06-reconciliation.test.ts` | PASS |
| 7 | Payment method outcomes | `07-payment-methods.test.ts` + `07-payment-methods.sandbox.test.ts` | Mocked: PASS for card, UPI, netbanking and wallet × success, failure, pending and abandoned. **Live sandbox: SKIPPED (NOT VERIFIED)**, because no sandbox keys are set. |
| 8 | Refunds: over-refund, double refund, unauthorised | `08-refunds.test.ts` | PASS |
| 9 | Secret scan over repo and git history | `09-secret-scan.test.ts` | **1 FAIL (real finding, §3a).** No payment secret in tracked files or in any of the 661 commits. |
| 10 | DB integrity queries | `10-db-integrity.test.ts` + `payment-integrity.sql` | PASS against the fake DB. **Real DB: SKIPPED (NOT VERIFIED).** |

## 2. Issues still open

| # | Sev | Status |
|---|---|---|
| 11 | Medium | **Open, by your decision.** Every order still sends phone `9999999999`. Confirm with Cashfree that this is acceptable for your merchant account (go-live item). |
| 13 | Low | Open. A pending UPI payment still shows as "Payment failed" in the UI. The server side is fixed: 409 credits nothing, and the later webhook or reconciliation credits it. |
| 14 | Low | Open. No rate limit on coin `create-order` / `verify-payment`. |
| 15 | Low | Partly addressed: gateway reads now retry once, but `fetch` calls still have no timeout. |
| 16 | Low | Open. No freshness window on the webhook timestamp. Replays are harmless (test 3). |
| 17 | Low | Open, **and it applies to your machine right now** (§3c). |
| 18 | Info | Open. No CSP on student-web; no SRI on the SDK script (Cashfree requires loading it from their CDN). |

## 3. Things found that are not in the audit report (reported, not acted on)

**a. A private key is in git history.** Commit `159f42f` (2026-08-28, "student dashboard + teacher dashboard added") added PEM key material to `apps/student-web/src/lib/tokens.ts`. Commit `61076cb` removed it the same day, and HEAD contains no key. This is a JWT signing key, not a payment secret. If it was ever used as the real `JWT_PRIVATE_KEY`, or as a fallback for it, anyone with repo access can forge login tokens. **Your call:** rotate the JWT key pair if there's any chance it was used, and decide whether to rewrite history. Test 9's private-key check fails until this is resolved.

**b. Correction to `PAYMENT_AUDIT.md` §A.** Its "no secret in git history" result was based on `git log -p`, which **aborts partway** here: the repo's PDF diff driver fails, and only about 1.8 MB of 25.5 MB was read. The scan is now complete (`--no-textconv`, every commit covered). It found no payment secret; it did find (a). The only other hits were the `'test_secret'` fixture from the removed Razorpay test, allowlisted explicitly.

**c. A production Cashfree key in local `.env`.** `CASHFREE_CLIENT_SECRET` has the production format (`cfsk_ma_…prod…`), while `CASHFREE_ENV=sandbox`. Nothing used it. As configured, checkout fails closed: the sandbox API rejects a production key. `.env` is gitignored and not staged.

## 4. Database migrations (written, NOT applied)

Per your choice, nothing touched the live database. Apply with `npm run db:migrate:deploy` once reviewed:

1. `packages/database/prisma/migrations/20261019000000_payment_order_status_check/migration.sql`: CHECK constraint on `RazorpayOrder.status` (#8). It fails and changes nothing if a row holds another value; check first with the `SELECT … GROUP BY "status"` in the file header.
2. `packages/database/prisma/migrations/20261019000100_restrict_payment_record_deletes/migration.sql`: FKs to `ON DELETE RESTRICT` (#10). Generated offline with `prisma migrate diff` from schema files; only foreign keys change.

Why a CHECK constraint and not a Postgres enum (#8): an enum column makes the Prisma client cast to an enum type that doesn't exist until the migration runs. Your app and local dev use the live DB, so every payment query would have failed in between. The CHECK constraint enforces the same list with no deploy-order risk.

The code works **before and after** both migrations. Neither has been run against any database: NOT VERIFIED.

## 5. Test results (real output, final run)

```
payment-security  (npx vitest run --config tests/payment-security/vitest.config.mts)
 × 9. secret scan > git history > no private key material anywhere in git history
 ↓ 7. Cashfree sandbox (live, test mode only) > creates an order with our request shape and reads it back
 ↓ 10. integrity checks against a test database (read-only) > runs every check without error
 Test Files  1 failed | 19 passed (20)
      Tests  1 failed | 158 passed | 2 skipped (161)

packages/live-classes (npx vitest run)        Test Files  6 passed (6)   Tests  44 passed (44)
student-web payment tests                     Test Files  4 passed (4)   Tests  20 passed (20)
student-web, whole app                        Test Files 17 passed (17)  Tests 109 passed (109)
teacher-web, whole app                        Test Files 10 passed (10)  Tests 137 passed (137)
admin-panel, whole app                        Test Files  5 passed (5)   Tests  32 passed (32)

tsc --noEmit: packages/live-classes, student-web, teacher-web, admin-panel: no errors
npm audit --omit=dev: next no longer listed (29 → 27 total; the rest are outside the payment path)
npm ci --dry-run: OK
```

The failure is finding §3a. The two skips need credentials this session doesn't have.

## 6. NOT VERIFIED

- Any real Cashfree sandbox call or payment (core test 7 live part; no sandbox keys).
- Checkout loading in a browser under teacher-web's new CSP (#3).
- Both migrations against a real database (§4), and the integrity SQL against real data (core test 10).
- Exact Cashfree webhook payload fields for refunds and disputes. They're taken from Cashfree's docs, not from a received event.
- The GitHub Actions workflow and the Vercel cron in a real deployment.
- Whether the key in §3a was ever used in production.

## 7. Go-live checklist

- [ ] Rotate or retire the JWT key from commit `159f42f` if it was ever used; decide on a history rewrite (§3a).
- [ ] Get Cashfree **test** keys and set `CASHFREE_SANDBOX_CLIENT_ID` / `CASHFREE_SANDBOX_CLIENT_SECRET`, then run `npm run test:payments` so the live sandbox check runs.
- [ ] In sandbox, pay manually through the hosted checkout. UPI: `testsuccess@gocash`, `testfailure@gocash`, `testuserdropped@gocash`. Card: e.g. `4706131211212123`, OTP `111000`, expiry 03/2028, CVV 123. Netbanking: TEST Bank. Check coins, recordings, admin payments and the alerts for each.
- [ ] Open a recording unlock on teacher-web in a browser and confirm the Cashfree popup loads (#3).
- [ ] Review, then apply the two migrations (`npm run db:migrate:deploy`) after running the status pre-check query in the first one.
- [ ] Set on the production deployment only: `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET` (production), `CASHFREE_ENV=production`, `CRON_SECRET`, `PAYMENT_ALERT_WEBHOOK_URL`. Remove the production key from local `.env`.
- [ ] Cashfree dashboard: set the webhook URL to `https://<student-web-host>/api/webhooks/cashfree` (API version 2023-08-01) with payment, refund and dispute events enabled.
- [ ] GitHub repository secrets `APP_URL` and `CRON_SECRET`, so `reconcile-payments.yml` runs every 10 minutes. Note that `APP_URL` must point at an app that serves the cron route (both apps do).
- [ ] Confirm with Cashfree that the placeholder phone `9999999999` is acceptable (#11).
- [ ] Decide on step-up re-authentication for refunds (manual coin adjustments already require password + TOTP; refunds currently require only the `payments:refund` permission).
- [ ] Run `tests/payment-security/payment-integrity.sql` (read-only) after go-live, and periodically.
- [ ] Consider the Low items #13–#18.

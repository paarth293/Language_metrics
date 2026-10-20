# FIX_10_payments.md — Save PaymentOrder Row Before Calling Cashfree (Issue #10)

Branch: `fix/phase2-payments` (base `fix/phase1-observability` @ `49cd365`).

---

## 1. What Changed

### The Problem
Previously, in `coin-payments.ts` and `recording-payments.ts`, `createCashfreeOrder` was called first, and `PaymentOrder` was inserted into the database second. If the database insert failed (pool exhaustion, timeout, server crash), Cashfree held an active order that the user could pay for, but our database had no record of it. When payment webhooks or client verifications arrived, `settlePayment` could not find the order, causing money to be taken without coins or recordings being credited.

### The Fix
1. **Insert Row (status `CREATED`) Before Calling Gateway**:
   - Implemented helper `openPaymentOrder` in `packages/live-classes/src/open-payment-order.ts`:
     - Creates `PaymentOrder` with status `CREATED`. If this throws, Cashfree is never contacted and the API cleanly returns a 500 error.
     - Calls `createCashfreeOrder`.
     - If Cashfree rejects (4xx/5xx/network error/timeout), conditionally updates row status to `FAILED` and rethrows a clean 502/504 error.
2. **Reconciler Handles 404 for Open Orders Quietly**:
   - `packages/live-classes/src/cashfree.ts`: throws `CashfreeOrderNotFoundError` (subclass of `CashfreeError`, status 404) when Cashfree returns 404 on `fetchSuccessfulPayment` or `fetchCashfreeOrder`.
   - `packages/live-classes/src/payment-reconciliation.ts`: catches `CashfreeOrderNotFoundError` on open orders (`CREATED`/`FAILED`) older than 10 minutes, and conditionally marks them `EXPIRED` without incrementing `failed` and without triggering a `reconciliation_failed` alert incident.
   - Crash safety buffer: `mayRetireMissingOrder` ensures orders younger than 60 seconds are not retired to protect in-flight Cashfree calls from race conditions.
3. **Recording Payment Flow**:
   - `packages/live-classes/src/recording-payments.ts`: uses `openPaymentOrder`.
   - Reuses existing open orders for the same recording if `ACTIVE` in Cashfree.
   - If an open recording row has no Cashfree order (404), marks the row `EXPIRED` and generates a fresh order so the student is not permanently blocked from purchasing.
4. **Retry Idempotency / Deduplication (Option A)**:
   - `packages/live-classes/src/coin-payments.ts`: `reuseOpenCoinOrder` looks for an existing `CREATED` row for the user and same coin package (`receipt` prefix `coins_<n>_`) created within the last 30 minutes.
   - If Cashfree reports the order `ACTIVE`, returns the existing order details and `paymentSessionId` instead of creating duplicate orders at Cashfree.
   - If Cashfree reports 404, `EXPIRED`, or `TERMINATED`, transitions the row to `EXPIRED` and creates a new order.

---

## 2. Real Test Output

### Test Suites
Ran `npm run test:payments` across all suites:
```
 ✓ tests/payment-security/issue-10-retry-reuse.test.ts (6 tests) 82ms
 ✓ tests/payment-security/issue-10-order-before-cashfree.test.ts (18 tests) 197ms
 ✓ tests/payment-security/teacher-web-topup.test.ts (21 tests) 178ms
 ✓ tests/payment-security/08-refunds.test.ts (20 tests) 267ms
 ✓ tests/payment-security/issue-08-order-state-machine.test.ts (21 tests) 148ms
 ✓ tests/payment-security/06-reconciliation.test.ts (7 tests) 234ms
 ✓ tests/payment-security/07-payment-methods.test.ts (17 tests) 224ms
 ✓ tests/payment-security/issue-20-cron-safety.test.ts (7 tests) 666ms
 ✓ tests/payment-security/issue-12-alerts-and-retries.test.ts (13 tests) 254ms
 ✓ tests/payment-security/issue-02-recording-double-charge.test.ts (6 tests) 103ms
 ✓ tests/payment-security/03-webhooks.test.ts (6 tests) 120ms
 ✓ tests/payment-security/09-secret-scan.test.ts (7 tests) 2190ms

 Test Files  25 passed (25)
      Tests  217 passed | 2 skipped (219)
   Duration  16.05s
```

All 18 tests in `issue-10-order-before-cashfree.test.ts` and all 6 tests in `issue-10-retry-reuse.test.ts` pass:
- Database insert failure -> Cashfree never called (coins and recordings).
- Gateway failure (4xx, 5xx, network error, timeout) -> row transitioned to `FAILED`, clean error returned.
- Crash case -> orphan `CREATED` or `FAILED` row older than 10 minutes is quietly transitioned to `EXPIRED` by reconciler without raising ops alerts.
- Rows younger than 10 minutes are ignored by reconciler to protect in-flight requests.
- Recording retry reuses open order; if Cashfree returns 404 for existing row, marks it `EXPIRED` and creates a new order.
- Coin retry reuses existing open order for same pack within 30 minutes; different packs open separate orders.

---

## 3. NOT VERIFIED

- **Real Cashfree Sandbox/Production HTTP Responses**: Real Cashfree was not called; tested against the fake Cashfree harness. Cashfree's documentation states 404 `order_not_found` is returned for non-existent orders, but if real Cashfree returns a different status code (e.g. 400), the reconciler would count it as failed until 72 hours old.
- **Concurrent Sub-Millisecond Double Click**: Two requests arriving within microseconds can both read no open order and create two separate orders at Cashfree. However, each order requires separate user payment, and unpaid orders expire naturally after 30 minutes without money loss.

---

## 4. Manual Test Steps for the Human

### Step 1: Normal Coin Purchase Order Flow
1. Sign in to `apps/student-web` as a student.
2. Navigate to `/wallet` and click "Buy Coins" (e.g. 500 coins).
3. Inspect database:
   - Confirm `PaymentOrder` exists with status `CREATED` and `amount: 500`.
4. Do not pay, refresh the page within 10 minutes and click "Buy Coins" for the same pack again:
   - Check network response: returns the exact same `orderId` and `paymentSessionId` (reused).
   - Check database: no second `PaymentOrder` created.

### Step 2: Simulated Crash Case / Missing Gateway Order
1. In the database, manually insert a dummy `PaymentOrder`:
   - `orderId`: `coins_500_testorphan1`
   - `userId`: valid student user ID
   - `status`: `CREATED`
   - `createdAt`: 20 minutes ago
2. Trigger reconciliation sweep via `GET /api/cron/reconcile-payments` with `Authorization: Bearer <CRON_SECRET>`.
3. Verify:
   - The order is swept and transitioned to status `EXPIRED`.
   - The summary shows `{ expired: ["coins_500_testorphan1"], failed: [] }`.
   - No ops alerts (`cron_failed` or `reconciliation_failed`) are dispatched.

### Step 3: Gateway Error Handling
1. Temporarily configure an invalid `CASHFREE_SECRET_KEY` in local `.env`.
2. Attempt to create a coin order via checkout.
3. Verify:
   - Request returns HTTP 502 Bad Gateway with a clean `{ "error": "Payment provider is currently unavailable..." }`.
   - The `PaymentOrder` row in the database is recorded with status `FAILED`.

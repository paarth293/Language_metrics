# Plan for #10: save the PaymentOrder row before calling Cashfree

Branch: `fix/phase2-payments` (from `fix/phase1-observability` @ `49cd365`).
Status: Previously committed on `fix/phase2-payments` via `d26a046`, `017ad50`, and `2b58eec`. Verified against requirements below. Awaiting user "go" at Hard Gate.

## The problem today

In both `coin-payments.ts:74-75` and `recording-payments.ts:58-59`, the code calls Cashfree `POST /orders` first and inserts our `PaymentOrder` row second.

If the insert fails, Cashfree holds an order we have no record of:
- the DB is overloaded or the pool is exhausted;
- the function times out;
- the instance dies.

The student already has the `payment_session_id`, so they can pay it. When the webhook comes, `settlePayment` finds no row and parks the money as NEEDS_REVIEW, so a human has to fix it.

## New order of steps (the same for coins and recordings)

| # | Step | If this step fails |
|---|---|---|
| 1 | Build the receipt (it is also the order id), exactly as today. | — |
| 2 | **Insert `PaymentOrder` with status `CREATED`.** | Throw. **Cashfree is never called.** The route answers 500 as today (this counts towards the #8e 5xx alert). |
| 3 | Call Cashfree `POST /orders` with that order id. Still no retry, timeout still 10 s. | Mark the row `FAILED` (conditional, `CREATED` → `FAILED`). Rethrow a clean error: `CashfreeError` 502, or 504 on timeout, with the same messages as today. |
| 4 | Return `{ orderId, paymentSessionId, mode }`, plus `amount` and `currency` for recordings. | — |

Response shapes don't change, and neither do the pages.

No migration is needed:
- `CREATED` and `FAILED` are already allowed by the status CHECK constraint (`20261019000000_payment_order_status_check`).
- The `CREATED` → `FAILED` move is already in `TRANSITIONS`.

## Crash and failure cases, and who cleans them up

| Case | State left behind | Cleaned up by |
|---|---|---|
| A. The DB insert fails | Nothing anywhere | Nothing to clean |
| B. Cashfree rejects or is unreachable, and the FAILED update succeeds | Row `FAILED`; no Cashfree order | Reconciler: a Cashfree **404** means `EXPIRED`, quietly (new, see below) |
| C. Process dies between the insert and the Cashfree call (the crash case) | Row `CREATED`; no Cashfree order | Reconciler: 404 means `EXPIRED`, quietly |
| D. Cashfree times out but did create the order | Row `FAILED`; the Cashfree order is `ACTIVE`, and the student never received its session | It can't be paid without the session. Cashfree expires it after 30 min (`ORDER_TTL_MS`). The existing reconciler then sees `EXPIRED` and moves the row to `EXPIRED`. |
| E. The FAILED update itself fails (DB down after step 3) | Row stays `CREATED` | Same as C or D |
| F. Process dies after the Cashfree call, before responding | Row `CREATED`; Cashfree order `ACTIVE`, unpaid | Same as D |

Since `FAILED` stays payable (FAILED → PAID is allowed), money that turns up later for a B/D/E order is still credited by the webhook or the reconciler. Nothing gets stuck.

## Reconciler change: a 404 for an open order means EXPIRED, quietly

`reconcilePaymentOrders` already sweeps `CREATED` and `FAILED` orders that are between 10 min and 72 h old. Today a Cashfree 404 on `GET /orders/{id}/payments` throws a generic 502. That order would then appear in `summary.failed` and raise a `reconciliation_failed` incident on every run for 72 hours.

The change:
- `cashfree.ts`: when the response is 404, `fetchSuccessfulPayment` and `fetchCashfreeOrder` throw a new `CashfreeOrderNotFoundError` (a subclass of `CashfreeError`, status 404). Every other status behaves as today.
- In the reconciler, that error triggers a conditional `transitionOrder(… "EXPIRED")` and adds the order to `summary.expired`. It is not counted as a failure and raises no incident.

The 10-minute minimum age protects a request still in flight between steps 2 and 3. Only rows at least 10 minutes old are touched, and Cashfree answers within 10 s.

## Recording flow (plan question 4)

**Recommendation: include it.** It has the same bug, and the same fix adds 4 lines.

There is one extra point. `createRecordingPaymentOrder` reuses an open order (`CREATED`/`FAILED`) for the same recording by calling `fetchCashfreeOrder`. After this change, an open row can have no Cashfree order at all (cases B, C, E). Today that 404 becomes a 502, so **the student could never buy that recording again**. The plan: on `CashfreeOrderNotFoundError`, move that row to `EXPIRED` and create a new order.

## Decision needed: what "a retried request does not create two orders" should mean

Each request makes a fresh random receipt. A second click on "Buy" or a network retry therefore opens a second Cashfree order for coins today; recordings already reuse open orders. A double charge needs the student to pay both sessions, but two orders are still opened.

- **Option A (recommended): reuse an open order on retry, as the recording flow does.** Before step 2, look for this user's newest `CREATED` row for the same pack (receipt prefix `coins_<n>_`) that is younger than 30 min. If Cashfree says it is `ACTIVE`, return its session. If it is a 404, `EXPIRED` or `TERMINATED`, mark it `EXPIRED` and continue. This is the "reuse" half of #19, moved up from Phase 3; #19 then only adds the per-user rate limit.
  - Limit: two requests that arrive within the same few milliseconds can both see no open order and both create one. Each order still needs its own payment, and the unpaid one expires.
  - Closing that gap needs a lock held across the Cashfree call (up to 10 s on a DB connection). That is the same trade-off #20 rejected, so I'm not proposing it.
- **Option B: idempotency key from the browser.** The checkout page sends an `Idempotency-Key`, and the route stores key → order in Redis (`SET NX EX`). This is stricter for exact retries, but it changes the page and the route together and adds a Redis dependency to checkout.

## Tests (each shown failing first, then passing)

New file `tests/payment-security/issue-10-order-before-cashfree.test.ts`, using the existing fake DB and fake Cashfree. The fake Cashfree already returns 404 `order_not_found` for unknown orders.

1. The DB insert fails, so no Cashfree order is created (coins and recordings).
2. Cashfree fails (5xx, network error, timeout), so the row is `FAILED` and the response is a clean 502/504 (coins and recordings).
3. A retried request does not create two orders: one Cashfree order, and the same `orderId` and session are returned. This applies to coins (Option A) and recordings (already true).
4. The crash case: a `CREATED` row with no Cashfree order, older than 10 min, is moved to `EXPIRED` by the reconciler. There is no incident and nothing in `summary.failed`. The same holds for a `FAILED` row.
5. A row younger than 10 min is left alone (protects in-flight requests).
6. Recording reuse when the open row has no Cashfree order: the row becomes `EXPIRED` and a new order is created, instead of a 502.
7. Regression: the existing `test:payments` suites (01–10, issue-*) still pass, with only the known #12 failure and its 2 skips.

## Files to change

- `packages/live-classes/src/cashfree.ts`: add `CashfreeOrderNotFoundError` and throw it on 404 in the two GETs.
- `packages/live-classes/src/open-payment-order.ts`: extracted helper to insert `PaymentOrder` (status `CREATED`) first, invoke `createCashfreeOrder`, transition to `FAILED` on error, and `mayRetireMissingOrder` (60s in-flight buffer).
- `packages/live-classes/src/coin-payments.ts`: uses `openPaymentOrder`, plus Option A retry reuse via `reuseOpenCoinOrder`.
- `packages/live-classes/src/recording-payments.ts`: uses `openPaymentOrder`; 404 on reuse marks row `EXPIRED` and creates fresh order.
- `packages/live-classes/src/payment-reconciliation.ts`: 404 catches `CashfreeOrderNotFoundError` and marks open row `EXPIRED` quietly without alert.
- `tests/payment-security/issue-10-order-before-cashfree.test.ts`: 18 tests covering order-before-Cashfree lifecycle, crash cases, reconciler 404, recording reuse.
- `tests/payment-security/issue-10-retry-reuse.test.ts`: 6 tests covering Option A coin retry reuse.

Commits on `fix/phase2-payments`:
1. `d26a046`: Save the PaymentOrder row before calling Cashfree (#10)
2. `017ad50`: Never expire an open order whose Cashfree call may still be running (#10)
3. `2b58eec`: Reuse a student's open coin order for the same pack on retry (#10)

## NOT VERIFIED

- That real Cashfree (sandbox or live) returns HTTP 404 for an unknown order on `GET /orders/{id}` and `GET /orders/{id}/payments`. Cashfree's API reference documents a 404 `order_not_found`, but this run won't call Cashfree. If it instead returns, say, a 400, those rows keep being reported as `reconciliation_failed` until 72 h old.
- Real Postgres behaviour; only the fake DB is used.

## Questions for your "go"

1. Include the recording flow? (Recommended: yes.)
2. Option A or Option B for retries? (Recommended: A.)

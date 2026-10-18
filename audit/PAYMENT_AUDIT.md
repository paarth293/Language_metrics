# Payment Gateway Audit — Language Metrics

- **Date:** 2026-10-18
- **Branch / commit audited:** `Priyanshu` @ `175a92b`
- **Mode:** read-only. No code file was changed. This report is the only file created.
- **Status:** complete (Steps 1–3).
- **Disclosure:** the Cashfree integration under audit was written by the same assistant earlier in this session. Read the findings with that in mind; every claim below cites a file and line you can open.
- **Method:** static reading of source, schema and migrations, a regex scan of git history, and `npm audit`. No payment was run against the Cashfree sandbox and nothing was tested in a browser.

---

## STEP 1 — Discovery

### 1.1 Stack

| Item | Finding | Evidence |
|---|---|---|
| Gateway | **Cashfree Payment Gateway**, REST API version `2023-08-01`, called with raw `fetch` (no Cashfree SDK on the server) | `packages/live-classes/src/cashfree.ts:9`, `:36`, `:50` |
| Browser checkout | Cashfree JS SDK v3, loaded on demand from `https://sdk.cashfree.com/js/v3/cashfree.js`, opened as `_modal` | `packages/ui/src/cashfree.ts:28`, `:48` |
| Language | TypeScript | all files below |
| Framework | Next.js App Router route handlers (student-web, teacher-web, admin-panel), npm-workspaces monorepo | `apps/*/src/app/api/**/route.ts` |
| Database | PostgreSQL through Prisma 5.22 | `packages/database/prisma/schema.prisma:5-9` |
| Previous gateway | Razorpay. It was removed in the last 53 commits; the database table and column names keep their old `Razorpay` names through `@@map`/`@map` | `schema.prisma:403-404`, `:945` |

### 1.2 Payment-related inventory

**Server: gateway client and settlement**
| File | Role |
|---|---|
| `packages/live-classes/src/cashfree.ts` | Cashfree client: create order, fetch payments, verify webhook signature, parse webhook |
| `packages/live-classes/src/recording-payments.ts` | Recording unlock (₹299): create order, verify, settle |
| `apps/student-web/src/lib/payment-settlement.ts` | Coin top-up settlement (credits coins) |
| `packages/database/src/coin-ledger.ts` | `credit()` with idempotency key (`:163-184`) |

**Routes**
| Route | File | Auth |
|---|---|---|
| `POST /api/payments/create-order` | `apps/student-web/src/app/api/payments/create-order/route.ts` | STUDENT |
| `POST /api/payments/verify-payment` | `apps/student-web/src/app/api/payments/verify-payment/route.ts` | STUDENT |
| `POST /api/webhooks/cashfree` | `apps/student-web/src/app/api/webhooks/cashfree/route.ts` | HMAC signature |
| `POST /api/students/payments/cashfree/order` | `apps/student-web/.../cashfree/order/route.ts` and `apps/teacher-web/.../cashfree/order/route.ts` | STUDENT + rate limit |
| `POST /api/students/payments/cashfree/verify` | `apps/student-web/.../cashfree/verify/route.ts` and `apps/teacher-web/.../cashfree/verify/route.ts` | STUDENT |

**Client**
| File | Role |
|---|---|
| `packages/ui/src/cashfree.ts` | SDK loader + `openCashfreeCheckout` |
| `apps/student-web/src/components/payments/CashfreeCheckout.tsx` | Coin pack pay button |
| `apps/student-web/src/components/payments/CoinPurchaseModal.tsx` | Coin pack list |
| `apps/student-web/src/types/coins.ts` | Coin packs (server price table, also imported by the client) |
| `apps/student-web/src/app/(authenticated)/recordings/page.tsx`, `apps/teacher-web/src/app/student/recordings/page.tsx` | Recording unlock flow |
| `apps/student-mobile/src/screens/WalletScreen.tsx` | Shows packs only; no payment on mobile |

**Models / migrations**
| Model | Location | Notes |
|---|---|---|
| `PaymentOrder` (table `RazorpayOrder`) | `schema.prisma:930-946`; created in `migrations/20260925000000_livekit_integration/migration.sql:142` | `orderId @unique`, `paymentId @unique`, `status String` |
| `Payment` | `schema.prisma:396-410`; `migrations/0_init/migration.sql:383-384,605,608` | `gatewayOrderId`/`gatewayPaymentId @unique` |
| `CoinTransaction` | `schema.prisma:143-165` | `idempotencyKey @unique` |
| `CoinAccount` | `schema.prisma:173-188` | materialised balance |
| Enums `PaymentType`, `PaymentStatus` | `schema.prisma:823-835` | |

**Cron jobs / queues**
- Only cron: `/api/cron/reconcile-sessions`, daily (`vercel.json:5-9`). A grep of its route for `payment|paymentOrder|cashfree` returned nothing, so it does **not** reconcile payments.
- Queues: grep for `bullmq|qstash|inngest` returned no match. **No queue exists.**

**Environment variables** (read in code: `cashfree.ts:29,33,34,99`; documented: `.env.example:66-73`)
| Variable | Secret? | Used where |
|---|---|---|
| `CASHFREE_CLIENT_ID` | no (identifier) | server only |
| `CASHFREE_CLIENT_SECRET` | **yes**. It is both the API secret and the webhook key | server only |
| `CASHFREE_ENV` | no (`sandbox` by default, or `production`) | server; the mode is passed to the browser in the order response |

### 1.3 Payment flow

```
 Browser (student)          student-web / teacher-web API         Cashfree PG            PostgreSQL
 ─────────────────          ─────────────────────────────         ───────────            ──────────
 1. click "Pay"  ─────────► POST create-order / cashfree/order
                            requireAuth(STUDENT)
                            price from server table (COIN_PACKAGES / RECORDING_PRICE_INR)
                            order_id = receipt "coins_<n>_<hex>" | "rec_<id>_<hex>"
                                          ─── POST /pg/orders ───────►
                                          ◄── payment_session_id ─────
                                          ─── INSERT PaymentOrder status=CREATED ──────────────────►
 ◄── {orderId, paymentSessionId, mode}
 2. Cashfree.checkout(_modal) ──────────────────────────────────────► customer pays (card/UPI/NB/wallet)
 ◄── promise resolves (paymentDetails | error) ◄────────────────────
 3. POST verify-payment / cashfree/verify {orderId}
                            find PaymentOrder, check owner
                                          ─── GET /pg/orders/{id}/payments ─►
                                          ◄── [ ... payment_status=SUCCESS ] ─
                            settle (single DB transaction):
                              check SUCCESS + amount + currency
                              UPDATE PaymentOrder SET PAID WHERE status<>PAID ────────────────────►
                              coins:      credit(idempotencyKey="cashfree:<orderId>") ──────────────►
                              recordings: classSession.isRecordingPaid=true + INSERT Payment ─────►
 ◄── {success:true}
 4. (async)                 POST /api/webhooks/cashfree  ◄────────── PAYMENT_SUCCESS_WEBHOOK
                            HMAC(timestamp+raw, secret) check
                            route by order_id prefix → same settle function (idempotent)
```

### 1.4 Supported payment methods

The code never restricts or names a payment method. `createCashfreeOrder` sends no `order_meta.payment_methods` (`cashfree.ts:52-57`), so the checkout offers whatever the Cashfree merchant account has enabled. The FAQ text claims "UPI, credit/debit cards, net banking, and wallets" (`apps/student-web/src/app/(authenticated)/faq/page.tsx:64`).

| Method | Support in code |
|---|---|
| Cards (3DS) | Implicit (Cashfree hosted), no specific handling |
| UPI (collect / intent / QR) | Implicit, no specific handling of the asynchronous PENDING state beyond a 409 reply |
| Netbanking | Implicit |
| Wallets | Implicit |
| EMI / Pay Later | NOT FOUND. Depends on the merchant dashboard |
| Subscriptions | **NOT FOUND.** No subscription code exists |

---

## STEP 2 — Audit (A–L)

Severity scale: **Critical** (direct money loss at scale) · **High** (money lost or stuck for some users, or checkout broken) · **Medium** · **Low** · **Info**.

### A. Secrets

| Check | Result | Evidence |
|---|---|---|
| No secret in the frontend | **PASS** | `CASHFREE_CLIENT_SECRET` is read only in server code (`packages/live-classes/src/cashfree.ts:34`, `:99`). A repo grep for `process.env.(CASHFREE|RAZORPAY|NEXT_PUBLIC_CASHFREE)` finds only `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET` and `CASHFREE_ENV`, all inside `cashfree.ts`. The browser receives only `paymentSessionId` and `mode` (`create-order/route.ts:40`). |
| No secret in git history | **PASS (pattern-limited)** | `git log --all -p` grepped for `rzp_(live|test)_…`, `cfsk_ma_(prod|test)_…` and `(RAZORPAY_*|CASHFREE_*)=<8+ chars>` returned 0 matches. Tracked env files are `.env.example`, `apps/student-mobile/.env.example` and `apps/teacher-web/.env.example`; the payment keys in `.env.example:70-71` are empty `""`. Secrets in other formats would not be caught. |
| No secret in logs | **PASS** | Payment logs print error objects only: `cashfree.ts:60` (Cashfree error body), `create-order/route.ts:44`, `verify-payment/route.ts:29`, `webhooks/cashfree/route.ts:24`. None prints headers or env values. |
| Live/test keys separated | **PARTIAL — Low** | One key pair plus `CASHFREE_ENV` (`cashfree.ts:28-30`, `:36`). It defaults to **sandbox**, so a production deploy without `CASHFREE_ENV=production` sends production keys to the sandbox and every order fails. This fails closed (no money is lost), but it is an outage. *Fix:* in production (`NODE_ENV=production`), throw at startup when `CASHFREE_ENV` is unset. |
| `.env` ignored | **PASS** | `.gitignore:23-25` (`.env`, `.env.*`, `!.env.example`); `apps/admin-panel/.gitignore:34`. |
| HTTPS enforced | **PASS** | HSTS in `apps/student-web/next.config.ts:28-31` and `apps/teacher-web/next.config.ts:107-110`; gateway URLs are `https://` (`cashfree.ts:36`). The webhook URL registered in the Cashfree dashboard is NOT VERIFIED. |

### B. Order creation

| Check | Result | Evidence |
|---|---|---|
| Amount computed on the server | **PASS** | Coins: the price comes from the server table `COIN_PACKAGES` (`apps/student-web/src/types/coins.ts:15-19`), chosen by `packageId`; any client `amount` that differs is rejected (`create-order/route.ts:17-22`). Recordings: `RECORDING_PRICE_INR = 299` (`recording-payments.ts:5`); the client amount is ignored. The price is a code constant, not a DB row. |
| Integer money, no float | **PASS** | DB `amount Int` (rupees) at `schema.prisma:934` and `Payment.amount Int` (paise) at `:405`. Cashfree's decimal `payment_amount` is converted once with `Math.round(x*100)` (`cashfree.ts:79`), and comparisons are integer (`payment-settlement.ts:20`, `recording-payments.ts:48`). |
| Gateway order saved as CREATED before payment | **PASS** | `db.paymentOrder.create({... status:'CREATED'})` (`create-order/route.ts:29-38`, `recording-payments.ts:32`) runs before the `paymentSessionId` is returned, so the customer cannot pay an order the DB does not know. If the insert fails, an orphan Cashfree order remains that nobody can pay (harmless). |
| Currency fixed on the server | **PASS** | `order_currency: "INR"` (`cashfree.ts:55`); the client `currency` must equal `'INR'` (`create-order/route.ts:20`); the provider echo is checked (`cashfree.ts:65`). |

### C. Verification

| Check | Result | Evidence |
|---|---|---|
| HMAC checked, constant-time | **PASS (by design)** | Cashfree's modal checkout has no client-side signature, so the browser callback carries no proof. The code ignores browser data and re-fetches the payment from Cashfree instead (`verify-payment/route.ts:17-18`). Webhook HMAC uses `timingSafeEqual` with a length guard (`cashfree.ts:101-103`). |
| Backend re-fetches and matches amount, currency, order_id and status | **PASS** | `GET /pg/orders/{id}/payments` (`cashfree.ts:89`); `order_id` is bound to the queried order (`:94`, `:79`); status `SUCCESS` (`payment-settlement.ts:19`, `recording-payments.ts:47`); amount and currency (`payment-settlement.ts:20-22`, `recording-payments.ts:48`). |
| Payment bound to the right user and order | **PASS** | Owner check before the gateway call (`verify-payment/route.ts:16`, `recording-payments.ts:67`) and again inside the transaction (`payment-settlement.ts:18`, `recording-payments.ts:44`). Recording ownership is checked through the booking (`recording-payments.ts:26`, `:49`). |

Evidence snippet (`payment-settlement.ts:18-22`):
```ts
if (userId && order.userId !== userId) throw new PaymentError("Order not found", 404);
if (payment.status !== "SUCCESS") throw new PaymentError("Payment is awaiting confirmation. …", 409);
if (payment.amount !== order.amount * 100 || payment.currency !== order.currency) {
```

### D. Webhooks

| Check | Result | Evidence |
|---|---|---|
| Signature over the raw body | **PASS** | `req.text()` before `JSON.parse` (`webhooks/cashfree/route.ts:10-12`); HMAC over `timestamp + rawBody` (`cashfree.ts:101`). |
| Replay window | **FAIL — Low** | `x-webhook-timestamp` is signed but never checked for freshness (`cashfree.ts:98-104`). Impact is limited because settlement is idempotent. *Fix:* reject when `abs(Date.now() - Number(timestamp)) > 5 min`. |
| Event idempotency (unique event_id) | **PARTIAL** | No event table and no `event_id` store. Idempotency is per order: a conditional `PAID` update (`payment-settlement.ts:38-42`) plus unique `CoinTransaction.idempotencyKey` (`schema.prisma:153`; `livekit_integration/migration.sql:210`). This is enough for success events only. |
| Out-of-order events | **PASS (trivially)** | Only the `CREATED → PAID` transition exists, and a PAID order is never downgraded (`payment-settlement.ts:23-26`). |
| Fast 2xx + async work | **PARTIAL** | Processing is synchronous inside the request (`route.ts:13-17`), but it is a single short DB transaction. No queue exists (Step 1). |
| All events handled | **FAIL — Medium** | Only `PAYMENT_SUCCESS_WEBHOOK` is processed (`cashfree.ts:110`). Failed, user-dropped, refund and dispute events get a 200 with no action (`route.ts:13`, `:18`). Subscriptions: none exist. *Fix:* handle the failed / user-dropped payment events (mark FAILED), refund events (mark REFUNDED and reverse coins), and dispute events (flag and alert). |
| Permanent failures are dead-lettered | **FAIL — Medium** | When a signed SUCCESS webhook cannot be settled (order missing → 404, amount mismatch → 400; `payment-settlement.ts:17`, `:20-22`; `recording-payments.ts:44`, `:48`), the route returns 4xx (`route.ts:20-21`). Cashfree retries a few times and gives up. The money is taken and nothing is recorded or alerted. *Fix:* persist the event to a `PaymentIncident` table, alert, and return 200. |

### E. Double payment / races

| Check | Result | Evidence |
|---|---|---|
| Callback + webhook at the same time | **PASS** | Both use the same transaction. `updateMany where status <> 'PAID'` (`payment-settlement.ts:38-42`, `recording-payments.ts:55-56`) takes a row lock; under Postgres READ COMMITTED the second writer re-evaluates and gets `count = 0`. The coin credit also carries the unique key `cashfree:<orderId>` (`payment-settlement.ts:45`; checked at `coin-ledger.ts:169`). |
| Double click | **PASS (client-only)** | Coins: a ref guard (`CashfreeCheckout.tsx:16-21`). Recordings: a state guard (`recordings/page.tsx:58`). |
| Refresh / retry of verify | **PASS** | Re-verifying a PAID order with the same payment returns early (`payment-settlement.ts:23-26`). |
| **Paying twice for one recording** | **FAIL — High** | `isRecordingPaid` is checked only when the order is created (`recording-payments.ts:28`). Two tabs, or a second attempt while a UPI payment is pending, create two orders. Both can be paid, and settlement unlocks again and writes a second `Payment` row without checking `isRecordingPaid` (`recording-payments.ts:49-58`). The student is charged ₹299 twice and nothing refunds it. *Fix:* reuse an existing un-expired CREATED order for the same recording, and in settlement treat an already-unlocked session as a duplicate that triggers a refund and an alert. |
| Unique constraints on gateway ids | **PASS** | `PaymentOrder.orderId` and `paymentId` are unique (`schema.prisma:933`, `:938`; `livekit_integration/migration.sql:195`, `:198`); `Payment.gatewayOrderId` and `gatewayPaymentId` are unique (`schema.prisma:403-404`; `0_init/migration.sql:605`, `:608`). |

Evidence snippet (`recording-payments.ts:49-57`). There is no `isRecordingPaid` check before the unlock:
```ts
const session = await tx.classSession.findFirst({ where: { id: sessionId, booking: { studentId: order.userId } } });
if (!session) throw new RecordingPaymentError("Recording not found", 404);
if (order.status === "PAID") { … }
const claimed = await tx.paymentOrder.updateMany({ where: { id: order.id, status: { not: "PAID" } }, … });
await tx.classSession.update({ where: { id: session.id }, data: { isRecordingPaid: true } });
```

### F. Stuck payments

| Check | Result | Evidence |
|---|---|---|
| State machine | **FAIL — Medium** | `PaymentOrder.status` is a free-text `String` (`schema.prisma:936`). Only `CREATED` (`create-order/route.ts:34`, `recording-payments.ts:32`) and `PAID` (`payment-settlement.ts:40`, `recording-payments.ts:55`) are ever written: no PENDING, FAILED, EXPIRED or REFUNDED. `signature` (`schema.prisma:939`) is never written any more. *Fix:* use a Prisma enum and allow only the valid transitions (`CREATED → PAID / FAILED / EXPIRED`, `PAID → REFUNDED`). |
| Reconciliation cron for old orders | **FAIL — High** | The only cron is `reconcile-sessions` (`vercel.json:5-9`), and it does not touch payments (a grep for `payment|paymentOrder|cashfree` in its route returned nothing). Verification runs only from the open page (`CashfreeCheckout.tsx:39-43`, `recordings/page.tsx:74-78`), and the student has no UI to retry an old order. If the tab closes and the webhook is missing, misconfigured or rejected, **money is deducted and coins are never credited**. *Fix:* a cron every 10–15 minutes that selects `CREATED` orders older than 15 minutes (and younger than 72 hours), calls `fetchSuccessfulPayment`, settles them, marks EXPIRED from Cashfree's `GET /pg/orders/{id}` `order_status`, and alerts on anything still stuck after an hour. |
| "Money deducted, DB not updated" | **FAIL — High** | Recovery depends entirely on the webhook (see above and D). |
| "DB updated, fulfilment failed" | **PASS** | The status update and the fulfilment (credit or unlock + Payment row) share one `$transaction` (`payment-settlement.ts:15-47`, `recording-payments.ts:42-59`), so they commit or roll back together. |
| Retries and alerts | **FAIL — Medium** | No retry on gateway calls and no alerting anywhere in the payment code. Only `console.error` (see A). |

### G. Payment methods

| Check | Result | Evidence |
|---|---|---|
| Cards / 3DS | **NOT VERIFIED** | Handled by Cashfree's hosted modal; no code path is specific to cards. No live test was run. |
| UPI pending / collect / QR | **FAIL — Low** | A pending payment makes verify return 409 (`verify-payment/route.ts:19-21`), but the coin UI shows it as **"Payment failed: …"** (`CoinPurchaseModal.tsx:57-58`), and the recordings UI shows a generic "Payment verification failed" (`recordings/page.tsx:79`). The student may pay again (see the double-charge finding in E). No polling. |
| Netbanking / wallets | **NOT VERIFIED** | Implicit through Cashfree. |
| EMI / subscriptions | **NOT FOUND** | |
| Abandon path | **PASS** | The modal's `result.error` stops the flow before verify (`CashfreeCheckout.tsx:35-37`, `recordings/page.tsx:71`). Whether the SDK can report `error` after a successful payment is NOT VERIFIED; if it can, the webhook is the only recovery. |
| Customer identity | **FAIL — Medium** | Every order is sent with the same phone `9999999999` (`cashfree.ts:11`, `:56`). Cashfree's risk checks, OTP/UPI prefill and support lookups all see one fake customer. *Fix:* collect a real phone number, or confirm with Cashfree that a placeholder is acceptable for your account. |
| No raw card data stored | **PASS** | No card, CVV or PAN fields in the schema (grep of `schema.prisma` found none). |

### H. Refunds

| Check | Result | Evidence |
|---|---|---|
| Gateway refunds (server-only, admin-only, amount ≤ paid, no double refund) | **NOT FOUND / FAIL — Medium** | No code calls a Cashfree refund API, and `PaymentStatus.REFUNDED` (`schema.prisma:834`) is never written. Refunds elsewhere in the repo are **coin** refunds for cancelled classes, not money. Without a refund path, duplicates (E) and mismatches (D) can only be refunded by hand in the Cashfree dashboard. *Fix:* an admin-only route that calls Cashfree's refund API for the order with a deterministic `refund_id` (for idempotency), checks `amount ≤ paid − already refunded`, and records the result. |
| Disputes | **NOT FOUND** | |

### I. Database

| Check | Result | Evidence |
|---|---|---|
| Unique constraints on gateway ids / event_id | **PASS / N/A** | See E. There is no event_id because there is no event table. |
| Foreign keys | **PASS, with a risk (Medium)** | `RazorpayOrder_userId_fkey … ON DELETE CASCADE` (`livekit_integration/migration.sql:240`; `schema.prisma:942`). CoinTransaction also cascades (`schema.prisma:160`). **Deleting a user erases their payment orders and coin ledger.** *Fix:* `onDelete: Restrict`, or anonymise the user instead of deleting. |
| Transactions on multi-step writes | **PASS** | See F. |
| No sensitive card data | **PASS** | See G. |
| Parameterised queries | **PASS** | Prisma client, plus tagged-template `$queryRaw` / `$executeRaw` (`coin-ledger.ts:84-88`, `:172-180`). |
| Audit trail | **FAIL — Medium** | Coin purchases write **no `Payment` row**. Only recording unlocks do (`recording-payments.ts:58` is the only `payment.create` in the repo). The admin payments page lists only `db.payment` (`apps/admin-panel/src/app/(dashboard)/payments/page.tsx:18-30`), so **coin top-ups never appear there**. The coin ledger entry (`coin-ledger.ts:182`) is the only record. *Fix:* insert `Payment { type: COIN_PURCHASE, status: SUCCESS, gatewayOrderId, gatewayPaymentId }` in the same transaction, next to `payment-settlement.ts:43`. |
| Least-privilege DB user | **NOT VERIFIED** | The deployed DB role and RLS policies were not inspected. |

### J. API access

| Check | Result | Evidence |
|---|---|---|
| Auth on every payment endpoint | **PASS** | `requireAuth(…, 'STUDENT')` at `create-order/route.ts:10`, `verify-payment/route.ts:9` and both apps' `cashfree/order/route.ts:8` and `cashfree/verify/route.ts:7`. The webhook is authenticated by HMAC (`webhooks/cashfree/route.ts:11`). `requireAuth` checks the RS256 token, verified email and role (`apps/student-web/src/lib/auth.ts:78`, `:93`, `:106`). |
| IDOR | **PASS** | See C (owner checks). |
| Admin role checks | **PASS** | The admin payments page calls `requireAdmin()` (`payments/page.tsx:10`). |
| Rate limiting | **FAIL — Low** | Recording orders: 10/min (`cashfree/order/route.ts:10`). **No limit** on coin `create-order` or `verify-payment`, so an authenticated user can spam Cashfree order creation. The limiter falls back to in-memory when `REDIS_URL` is unset (`apps/student-web/src/lib/rate-limit.ts:75-77`), which does not hold across serverless instances. |
| Validation | **PASS** | The pack is matched on the server (`create-order/route.ts:17-22`); `orderId` must be a string and is looked up through Prisma (`verify-payment/route.ts:12-15`); `recordingId` is regex-checked as a UUID (`recording-payments.ts:23`). |
| CORS / CSRF | **PASS** | Auth cookies are `sameSite: "lax"` (`apps/student-web/src/lib/tokens.ts:110`, `:118`; `apps/teacher-web/src/lib/tokens.ts:102`, `:110`), so they are not sent on cross-site POSTs. No permissive CORS headers were found on these routes. |
| No secrets in logs | **PASS** | See A. |

### K. Frontend

| Check | Result | Evidence |
|---|---|---|
| No secret in the bundle | **PASS** | No `NEXT_PUBLIC_*` payment variable exists (A). |
| Redirect URL allow-list | **N/A** | No `return_url` is sent (`cashfree.ts:52-57`); checkout is `_modal` (`packages/ui/src/cashfree.ts:48`). |
| Checkout loads under the CSP | **FAIL — High** | teacher-web's CSP has `script-src 'self' 'unsafe-inline'` (`apps/teacher-web/next.config.ts:118`), a `connect-src` without Cashfree (`:123`) and `frame-src https://accounts.google.com` (`:124`). The SDK script at `https://sdk.cashfree.com/js/v3/cashfree.js` (`packages/ui/src/cashfree.ts:28`) and its frames are therefore blocked, so **recording unlocks on teacher-web's student pages cannot load the checkout**. Not confirmed in a browser. student-web sends no CSP at all (`apps/student-web/next.config.ts:24-31`; Info). *Fix:* add `https://sdk.cashfree.com` to `script-src`, and the Cashfree checkout and API origins (per Cashfree's CSP documentation) to `frame-src` and `connect-src`. |
| Processing / pending / failed / success UI | **FAIL — Low** | Processing state is present (`CashfreeCheckout.tsx:64`). Pending is shown as failure (G). Success and failure use `alert()` (`CoinPurchaseModal.tsx:53`, `:58`). |

Evidence snippet (`apps/teacher-web/next.config.ts:118`, `:124`):
```ts
`script-src 'self'${isProd ? "" : " 'unsafe-eval'"} 'unsafe-inline'`,
"frame-src https://accounts.google.com",
```

### L. Dependencies

| Check | Result | Evidence |
|---|---|---|
| Gateway SDK version | **N/A** | No Cashfree npm package; the server uses REST with `x-api-version: 2023-08-01` (`cashfree.ts:9`, `:41`). The browser SDK is the unversioned "v3" URL (`packages/ui/src/cashfree.ts:28`), with no Subresource Integrity (SRI) hash (Info). |
| `npm audit --omit=dev` | **FAIL — High** | 29 vulnerabilities (1 critical, 21 high, 7 moderate). On the payment path: **`next` 16.0.0–16.3.7 (high)**, and the apps declare `^16.3.6` (`apps/student-web/package.json:33`, `apps/teacher-web/package.json:41`). The installed version was not checked separately; npm audit flags the installed tree. Most of the rest are Expo / React Native tooling (`shell-quote` critical, `node-forge`, `metro`), plus `axios`, `nodemailer` and `sharp`. *Fix:* upgrade `next` to a patched release first. |
| Timeouts / retries on gateway calls | **FAIL — Low** | No `AbortSignal` / timeout on either `fetch` (`cashfree.ts:50`, `:89`), and no retry. A hanging Cashfree call holds the function until the platform kills it. *Fix:* `signal: AbortSignal.timeout(10_000)`, with one retry on the GET. |

---

## STEP 3 — Report

### 3.1 Payment flow diagram

See §1.3 above.

### 3.2 Findings table

| # | Severity | Area | File:Line | Issue | Fix |
|---|---|---|---|---|---|
| 1 | High | F | `vercel.json:5-9`; `apps/student-web/src/components/payments/CashfreeCheckout.tsx:39-43`; `recordings/page.tsx:74-78` | No reconciliation of old CREATED orders, and no way for a student to re-verify. A missed webhook means money is taken and nothing is credited. | Cron every 10–15 minutes: query Cashfree, settle or expire, alert |
| 2 | High | E | `packages/live-classes/src/recording-payments.ts:28`, `:49-58` | The same recording can be bought and charged twice | Reuse the open order; treat an already-unlocked session as a duplicate → refund + alert |
| 3 | High | K | `apps/teacher-web/next.config.ts:118`, `:123`, `:124` | The CSP blocks the Cashfree SDK and frames on teacher-web | Allow the Cashfree origins in script-src, frame-src and connect-src |
| 4 | High | L | `apps/student-web/package.json:33`; `apps/teacher-web/package.json:41` | `next` is in a version range npm audit flags high | Upgrade `next` to a patched release |
| 5 | Medium | D | `apps/student-web/src/app/api/webhooks/cashfree/route.ts:20-21` | Paid-but-unsettleable webhooks return 4xx and are dropped silently | Persist an incident, alert, return 200 |
| 6 | Medium | D | `packages/live-classes/src/cashfree.ts:110` | Failed, refund and dispute webhooks are ignored | Handle those event types |
| 7 | Medium | I | `apps/student-web/src/lib/payment-settlement.ts:38-46`; `apps/admin-panel/src/app/(dashboard)/payments/page.tsx:18-30` | Coin purchases leave no `Payment` row and are invisible to admin | Insert a `Payment` row in the settlement transaction |
| 8 | Medium | F | `packages/database/prisma/schema.prisma:936`, `:939` | No state machine; free-text status; only CREATED and PAID | Enum + guarded transitions |
| 9 | Medium | H | NOT FOUND (`schema.prisma:834` is never written) | No gateway refund path | Admin-only, idempotent Cashfree refund endpoint |
| 10 | Medium | I | `schema.prisma:942`, `:160`; `livekit_integration/migration.sql:240` | Deleting a user cascades away their payment and ledger records | `onDelete: Restrict` / anonymise instead |
| 11 | Medium | G | `packages/live-classes/src/cashfree.ts:11`, `:56` | Every customer is sent the same placeholder phone | Collect a real phone, or confirm with Cashfree |
| 12 | Medium | F | No alerting anywhere in the payment code | No retries or alerts | Alerting on payment errors |
| 13 | Low | G/K | `apps/student-web/src/components/payments/CoinPurchaseModal.tsx:57-58`; `recordings/page.tsx:79` | A pending UPI payment is shown as failed, so the student may pay again | Treat 409 as pending; poll |
| 14 | Low | J | `create-order/route.ts:8-26`; `verify-payment/route.ts:7-18`; `rate-limit.ts:75-77` | No rate limit on coin order and verify; in-memory fallback | Redis rate limit on both |
| 15 | Low | L | `packages/live-classes/src/cashfree.ts:50`, `:89` | No timeout on gateway calls | `AbortSignal.timeout` |
| 16 | Low | D | `packages/live-classes/src/cashfree.ts:98-104` | Webhook timestamp freshness is not enforced | ±5-minute window |
| 17 | Low | A | `packages/live-classes/src/cashfree.ts:28-30` | Missing `CASHFREE_ENV` silently means sandbox | Fail fast in production |
| 18 | Info | K | `apps/student-web/next.config.ts:24-31`; `packages/ui/src/cashfree.ts:28` | No CSP on student-web; no SRI on the SDK script | Add a CSP |

### 3.3 Checklist summary

| Area | Result |
|---|---|
| A. Secrets | PASS (live/test separation PARTIAL) |
| B. Order creation | PASS |
| C. Verification | PASS |
| D. Webhooks | **FAIL** (unhandled events, dropped failures, no replay window; idempotency PARTIAL) |
| E. Double payment / race | **FAIL** (recording double charge); concurrency handling PASS |
| F. Stuck payments | **FAIL** (no reconciliation, no state machine, no alerts) |
| G. Payment methods | **FAIL** (pending UX, placeholder phone); cards / netbanking / wallets NOT VERIFIED; EMI / subscriptions NOT FOUND |
| H. Refunds | **NOT FOUND / FAIL** |
| I. Database | **FAIL** (no Payment row for coins, cascade delete); constraints, transactions and queries PASS; DB role NOT VERIFIED |
| J. API access | PASS (rate limiting FAIL — Low) |
| K. Frontend | **FAIL** (teacher-web CSP, pending UX) |
| L. Dependencies | **FAIL** (`next` advisory, no timeouts) |

### 3.4 Top 5 ways to lose money or get stuck

1. **No reconciliation (#1).** A closed tab plus a missed or misconfigured webhook means the student is charged and receives nothing, with no automatic recovery.
2. **Dropped webhook failures (#5).** A signed success that fails settlement returns 4xx; Cashfree stops retrying and nobody is told.
3. **Double charge for a recording (#2).** Two orders for one recording can both be paid, and no refund path exists (#9).
4. **Pending shown as failed (#13).** Slow UPI payments tell the student "Payment failed", inviting a second payment.
5. **Teacher-web checkout blocked by CSP (#3).** Recording sales on teacher-web fail outright (lost revenue). Not yet confirmed in a browser.

### 3.5 Files read

Full files:
- `packages/live-classes/src/cashfree.ts`
- `packages/live-classes/src/recording-payments.ts`
- `packages/ui/src/cashfree.ts`
- `apps/student-web/src/lib/payment-settlement.ts`
- `apps/student-web/src/app/api/payments/create-order/route.ts`
- `apps/student-web/src/app/api/payments/verify-payment/route.ts`
- `apps/student-web/src/app/api/webhooks/cashfree/route.ts`
- `apps/student-web/src/app/api/students/payments/cashfree/order/route.ts` and `…/verify/route.ts`
- `apps/teacher-web/src/app/api/students/payments/cashfree/order/route.ts` and `…/verify/route.ts`
- `apps/student-web/src/components/payments/CashfreeCheckout.tsx`, `CoinPurchaseModal.tsx`
- `apps/student-web/src/types/coins.ts`
- `vercel.json`

Partial (line ranges):
- `apps/student-web/src/app/(authenticated)/recordings/page.tsx` (55–90)
- `packages/database/prisma/schema.prisma` (20–70, 143–190, 392–410, 820–840, 928–946)
- `packages/database/src/coin-ledger.ts` (1–203)
- `packages/database/prisma/migrations/20260925000000_livekit_integration/migration.sql` (140–160; grep of lines 195, 198, 201, 210, 240)
- `packages/database/prisma/migrations/0_init/migration.sql` (grep of lines 383–384, 605, 608)
- `apps/student-web/src/lib/auth.ts` (60–120); `apps/teacher-web/src/lib/auth.ts` (grep of lines 93, 106)
- `apps/student-web/src/lib/rate-limit.ts` (69–99)
- `apps/student-web/next.config.ts` (15–38); `apps/teacher-web/next.config.ts` (95–135)
- `apps/admin-panel/src/app/(dashboard)/payments/page.tsx` (1–40); `payments/[id]/page.tsx` (grep only)
- `.env.example` (66–73); `.gitignore` and `apps/admin-panel/.gitignore` (grep)
- `apps/student-web/src/lib/tokens.ts`, `apps/teacher-web/src/lib/tokens.ts`, `packages/auth/src/tokens.ts` (grep of `sameSite`)
- `apps/student-web/src/app/api/cron/reconcile-sessions/route.ts` (grep only: no payment code)
- `apps/student-web/package.json`, `apps/teacher-web/package.json` (the `next` line)

Tools:
- `git log --all -p` regex scan; `npm audit --omit=dev --json`; repo-wide greps for card fields, gateway env vars, `payment.create`, PaymentOrder status writes, queue libraries and `/api/v1` gateway use

### 3.6 Not checked

- Any live or sandbox payment, and any browser run (the CSP finding #3 is from static reading)
- Cashfree dashboard settings: webhook URL and version, enabled payment methods, risk settings
- Deployed environment variables and which Cashfree keys are in use
- The database role's privileges, Supabase RLS policies, and production logs
- Whether the Cashfree SDK can return `error` after a successful payment
- `apps/admin-panel/src/lib/coin-adjustments.ts` and other admin coin tools; teacher earnings and payout flows
- The mobile app (`apps/student-mobile`) beyond confirming it has no gateway code
- Git history for secrets in formats other than the regexes listed in A
- Booking and coin-spend flows, which do not touch the gateway

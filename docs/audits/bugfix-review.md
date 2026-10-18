# Bug review and corrections

Date: 2026-10-15

## Payment and wallet corrections

The student payment verification endpoint accepted `coinsToCredit` from the
browser and did not verify that the signed order belonged to the logged-in
student. Checkout verification and webhooks also marked orders paid and credited
the ledger in separate operations, with separate early idempotency markers.
A failure could leave an order paid without coins; concurrent callbacks could
credit the same purchase twice.

The corrected flow selects the package and price on the server, saves the coin
quantity in the existing receipt field, confirms order ownership, and checks the
provider's captured payment, order ID, currency, and amount. Both confirmation
paths call one settlement function. A conditional order update and ledger credit
commit inside the same database transaction. Signature comparisons use
constant-time comparison after validating the signature format.

The receipt snapshot fits Razorpay's 40-character receipt limit and requires no
database migration. Existing unpaid orders with published package prices resolve
to the package's coin quantity. Unrecognized legacy orders return a support
error rather than inventing a coin quantity. Historical paid orders and wallet
balances are not retrospectively changed by this patch.

The wallet top-up button now opens checkout. Checkout remains busy until success,
failure, or dismissal, preventing duplicate checkout windows and displaying
useful verification errors.

Provider behavior was checked against the official
[integration instructions](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
and [payment retrieval API](https://razorpay.com/docs/api/payments/fetch-with-id/).

## Classroom and chat corrections

- Retrying a rejected classroom join now enters the room after a successful token response.
- In-class chat stays subscribed while hidden and retains messages when reopened.
- Unread badges count incoming messages while hidden. Sender names come from the
  room participant, and invalid payloads and self echoes are ignored.
- Failed chat sends retain the draft and show an error instead of appearing delivered.
- Failed recording/end-class requests show an error; a failed end request keeps
  the teacher in the room so they can retry.
- Mobile selects screen shares before remote cameras and uses the local camera for self-view.
- Ordinary student chat in both web portals ignores obsolete responses after
  switching conversations, polls without replacing the page with its loading view,
  and avoids overlapping background fetches. Send/upload responses also stay with
  the conversation they belong to.
- Shared loading buttons remain disabled even if a caller passes `disabled=false`.

## Verification and limits

Regression coverage includes package price tampering, foreign orders, uncaptured
payments, duplicate settlement, ledger failures, classroom retry, hidden chat
messages, unsuccessful end requests, loading buttons, and delayed chat responses.

All 367 workspace tests passed. Lint completed with zero errors and existing
warnings. Type checks passed for both web portals, mobile, and the modified
shared packages; repository structure checks passed for all 13 workspaces.
Both affected web portals passed production builds after the final changes.

Unit tests use mocked provider and database operations; they do not execute real
payments or prove database concurrency against a running PostgreSQL instance.
Real payment capture/webhook delivery and two-person LiveKit calls still require
staging verification. Existing app lint warnings and the Prisma CommonJS build
warning remain separate maintenance work.

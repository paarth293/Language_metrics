// Coin settlement lives in @repo/live-classes so every app's reconciliation
// cron settles orders exactly the way checkout and webhooks do.
export { PaymentError, settlePayment } from "@repo/live-classes";

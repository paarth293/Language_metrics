-- Payment orders may only hold the statuses of the state machine in
-- packages/live-classes/src/payment-order-status.ts (audit issue #8).
--
-- A CHECK constraint rather than a Postgres enum: the Prisma column stays
-- TEXT, so the deployed client keeps working whether or not this migration
-- has been applied yet.
--
-- This fails, and changes nothing, if a row already holds another value.
-- Check first with:
--   SELECT "status", count(*) FROM "RazorpayOrder" GROUP BY "status";
ALTER TABLE "RazorpayOrder"
  ADD CONSTRAINT "RazorpayOrder_status_check"
  CHECK ("status" IN ('CREATED', 'FAILED', 'EXPIRED', 'PAID', 'DUPLICATE', 'NEEDS_REVIEW', 'REFUND_PENDING', 'REFUNDED'));

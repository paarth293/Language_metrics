-- Payment integrity checks (read-only). Each query should return no rows.
-- Run in the Supabase SQL editor or psql. Mirrors findPaymentIntegrityProblems()
-- in packages/live-classes/src/payment-integrity.ts.
--
-- Payment orders live in the "RazorpayOrder" table (Prisma model PaymentOrder;
-- the table kept its old name when the app switched to Cashfree).

-- paid_not_fulfilled: paid coin orders with no ledger credit,
-- and paid recording orders whose recording is still locked.
SELECT 'paid_not_fulfilled' AS check_name, o."orderId"
FROM "RazorpayOrder" o
WHERE o."status" = 'PAID'
  AND o."receipt" LIKE 'coins\_%'
  AND NOT EXISTS (
    SELECT 1 FROM "CoinTransaction" t
    WHERE t."idempotencyKey" IN ('cashfree:' || o."orderId", 'razorpay:' || o."orderId")
  )
UNION ALL
SELECT 'paid_not_fulfilled', o."orderId"
FROM "RazorpayOrder" o
JOIN "Payment" p ON p."razorpayOrderId" = o."orderId" AND p."type" = 'RECORDING_FEE'
JOIN "Booking" b ON b."id" = p."bookingId"
WHERE o."status" = 'PAID'
  AND o."receipt" LIKE 'rec\_%'
  AND NOT EXISTS (SELECT 1 FROM "ClassSession" s WHERE s."bookingId" = b."id" AND s."isRecordingPaid");

-- fulfilled_not_paid: coins credited or a SUCCESS payment recorded for an
-- order that is not (or no longer) paid. Refunded orders keep their credit row.
SELECT 'fulfilled_not_paid' AS check_name, o."orderId"
FROM "RazorpayOrder" o
WHERE o."status" NOT IN ('PAID', 'REFUND_PENDING', 'REFUNDED')
  AND (
    EXISTS (SELECT 1 FROM "CoinTransaction" t WHERE t."idempotencyKey" = 'cashfree:' || o."orderId")
    OR EXISTS (SELECT 1 FROM "Payment" p WHERE p."razorpayOrderId" = o."orderId" AND p."status" = 'SUCCESS')
  );

-- duplicate_payment_ids: one gateway payment attached to two records.
SELECT 'duplicate_payment_ids' AS check_name, "paymentId", count(*)
FROM "RazorpayOrder" WHERE "paymentId" IS NOT NULL
GROUP BY "paymentId" HAVING count(*) > 1
UNION ALL
SELECT 'duplicate_payment_ids', "razorpayPaymentId", count(*)
FROM "Payment" WHERE "razorpayPaymentId" IS NOT NULL
GROUP BY "razorpayPaymentId" HAVING count(*) > 1;

-- pending_too_long: still unpaid 30 minutes after checkout. Cashfree orders
-- expire after 30 minutes, so reconciliation should have closed these.
SELECT 'pending_too_long' AS check_name, "orderId", "status", "createdAt"
FROM "RazorpayOrder"
WHERE "status" IN ('CREATED', 'FAILED')
  AND "createdAt" < NOW() - INTERVAL '30 minutes';

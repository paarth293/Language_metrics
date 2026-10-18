-- Deleting a user must not erase what they paid (audit issue #10).
--
-- Payment orders and the coin ledger used to cascade with the User row, so a
-- deleted account took its payment history with it. RESTRICT makes such a
-- delete fail instead; erasure requests should anonymise the user.
-- ("Payment" was already ON DELETE RESTRICT.)
--
-- Generated offline with `prisma migrate diff --from-schema-datamodel
-- --to-schema-datamodel`; only foreign keys change, no rows are touched.

-- DropForeignKey
ALTER TABLE "CoinTransaction" DROP CONSTRAINT "CoinTransaction_userId_fkey";

-- DropForeignKey
ALTER TABLE "RazorpayOrder" DROP CONSTRAINT "RazorpayOrder_userId_fkey";

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RazorpayOrder" ADD CONSTRAINT "RazorpayOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


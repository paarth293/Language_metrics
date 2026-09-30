-- Multi-currency teacher rates. A teacher's rate is stored in their own
-- chosen currency (default INR, matching every existing row); students see
-- it converted into their own preferred currency at display time via
-- @repo/currency (live rates, Frankfurter/ECB), never at the coin/booking
-- layer, which stays untouched.

-- Idempotent: this dev database already has both columns from an earlier
-- `prisma db push` (done before this migration was authored), so plain
-- ADD COLUMN would fail here with "column already exists". IF NOT EXISTS
-- makes this a no-op here while still provisioning any other environment
-- (production, a teammate's DB) that doesn't have these columns yet.

-- AlterTable
ALTER TABLE "TeacherRate" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'INR';

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN IF NOT EXISTS "preferredCurrency" TEXT NOT NULL DEFAULT 'INR';

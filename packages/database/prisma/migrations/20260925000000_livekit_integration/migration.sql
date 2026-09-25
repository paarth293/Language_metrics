-- CreateEnum
CREATE TYPE "LiveParticipantRole" AS ENUM ('TEACHER', 'STUDENT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "NoShowParty" AS ENUM ('NONE', 'TEACHER', 'STUDENT', 'BOTH');

-- CreateEnum
CREATE TYPE "SessionBillingStatus" AS ENUM ('HELD', 'SETTLED', 'REFUNDED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordingStatus" AS ENUM ('NONE', 'REQUESTED', 'RECORDING', 'PROCESSING', 'AVAILABLE', 'FAILED');

-- CreateEnum
CREATE TYPE "RecordingMode" AS ENUM ('AUDIO', 'VIDEO');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "CoinTransactionType" ADD VALUE 'HOLD';
ALTER TYPE "CoinTransactionType" ADD VALUE 'HOLD_RELEASE';
ALTER TYPE "CoinTransactionType" ADD VALUE 'ADJUSTMENT';

-- AlterTable
ALTER TABLE "ClassSession" ADD COLUMN     "billableSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "connectionSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "downstreamBytes" BIGINT NOT NULL DEFAULT 0,
ADD COLUMN     "lkEgressId" TEXT,
ADD COLUMN     "lkRoomName" TEXT,
ADD COLUMN     "lkRoomSid" TEXT,
ADD COLUMN     "noShow" "NoShowParty" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "qualityProfile" TEXT NOT NULL DEFAULT 'low',
ADD COLUMN     "recordingDurationSeconds" INTEGER,
ADD COLUMN     "recordingError" TEXT,
ADD COLUMN     "recordingMode" "RecordingMode",
ADD COLUMN     "recordingSizeBytes" BIGINT,
ADD COLUMN     "recordingStatus" "RecordingStatus" NOT NULL DEFAULT 'NONE';

-- AlterTable
ALTER TABLE "CoinTransaction" ADD COLUMN     "balanceAfter" INTEGER,
ADD COLUMN     "bookingId" UUID,
ADD COLUMN     "classSessionId" UUID,
ADD COLUMN     "idempotencyKey" TEXT;

-- CreateTable
CREATE TABLE "CoinAccount" (
    "userId" UUID NOT NULL,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "heldBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimeEarned" INTEGER NOT NULL DEFAULT 0,
    "lifetimeSpent" INTEGER NOT NULL DEFAULT 0,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoinAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "LiveParticipantSession" (
    "id" UUID NOT NULL,
    "classSessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "LiveParticipantRole" NOT NULL,
    "identity" TEXT NOT NULL,
    "participantSid" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL,
    "leftAt" TIMESTAMP(3),
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "disconnectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveParticipantSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionBilling" (
    "classSessionId" UUID NOT NULL,
    "studentId" UUID NOT NULL,
    "teacherId" UUID NOT NULL,
    "heldCoins" INTEGER NOT NULL,
    "coinsPerMinute" INTEGER NOT NULL,
    "billedMinutes" INTEGER NOT NULL DEFAULT 0,
    "chargedCoins" INTEGER NOT NULL DEFAULT 0,
    "refundedCoins" INTEGER NOT NULL DEFAULT 0,
    "overageCoins" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionBillingStatus" NOT NULL DEFAULT 'HELD',
    "requiresReview" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionBilling_pkey" PRIMARY KEY ("classSessionId")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "error" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveKitUsageDaily" (
    "day" TEXT NOT NULL,
    "connectionSeconds" INTEGER NOT NULL DEFAULT 0,
    "participantSessions" INTEGER NOT NULL DEFAULT 0,
    "egressVideoSeconds" INTEGER NOT NULL DEFAULT 0,
    "egressAudioSeconds" INTEGER NOT NULL DEFAULT 0,
    "downstreamBytes" BIGINT NOT NULL DEFAULT 0,
    "classSessions" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveKitUsageDaily_pkey" PRIMARY KEY ("day")
);

-- CreateTable
CREATE TABLE "DeviceToken" (
    "id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RazorpayOrder" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "status" TEXT NOT NULL DEFAULT 'CREATED',
    "receipt" TEXT,
    "paymentId" TEXT,
    "signature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RazorpayOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinAccount_balance_idx" ON "CoinAccount"("balance");

-- CreateIndex
CREATE UNIQUE INDEX "LiveParticipantSession_participantSid_key" ON "LiveParticipantSession"("participantSid");

-- CreateIndex
CREATE INDEX "LiveParticipantSession_classSessionId_role_idx" ON "LiveParticipantSession"("classSessionId", "role");

-- CreateIndex
CREATE INDEX "LiveParticipantSession_userId_joinedAt_idx" ON "LiveParticipantSession"("userId", "joinedAt");

-- CreateIndex
CREATE INDEX "LiveParticipantSession_leftAt_idx" ON "LiveParticipantSession"("leftAt");

-- CreateIndex
CREATE INDEX "SessionBilling_status_idx" ON "SessionBilling"("status");

-- CreateIndex
CREATE INDEX "SessionBilling_studentId_idx" ON "SessionBilling"("studentId");

-- CreateIndex
CREATE INDEX "SessionBilling_teacherId_idx" ON "SessionBilling"("teacherId");

-- CreateIndex
CREATE INDEX "SessionBilling_requiresReview_idx" ON "SessionBilling"("requiresReview");

-- CreateIndex
CREATE INDEX "WebhookEvent_source_eventType_receivedAt_idx" ON "WebhookEvent"("source", "eventType", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_eventId_key" ON "WebhookEvent"("source", "eventId");

-- CreateIndex
CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayOrder_orderId_key" ON "RazorpayOrder"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "RazorpayOrder_paymentId_key" ON "RazorpayOrder"("paymentId");

-- CreateIndex
CREATE INDEX "RazorpayOrder_userId_idx" ON "RazorpayOrder"("userId");

-- CreateIndex
CREATE INDEX "ClassSession_lkRoomName_idx" ON "ClassSession"("lkRoomName");

-- CreateIndex
CREATE INDEX "ClassSession_recordingStatus_idx" ON "ClassSession"("recordingStatus");

-- CreateIndex
CREATE UNIQUE INDEX "CoinTransaction_idempotencyKey_key" ON "CoinTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "CoinTransaction_classSessionId_idx" ON "CoinTransaction"("classSessionId");

-- CreateIndex
CREATE INDEX "CoinTransaction_bookingId_idx" ON "CoinTransaction"("bookingId");

-- AddForeignKey
ALTER TABLE "CoinAccount" ADD CONSTRAINT "CoinAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveParticipantSession" ADD CONSTRAINT "LiveParticipantSession_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveParticipantSession" ADD CONSTRAINT "LiveParticipantSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBilling" ADD CONSTRAINT "SessionBilling_classSessionId_fkey" FOREIGN KEY ("classSessionId") REFERENCES "ClassSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBilling" ADD CONSTRAINT "SessionBilling_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionBilling" ADD CONSTRAINT "SessionBilling_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "TeacherProfile"("userId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceToken" ADD CONSTRAINT "DeviceToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RazorpayOrder" ADD CONSTRAINT "RazorpayOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


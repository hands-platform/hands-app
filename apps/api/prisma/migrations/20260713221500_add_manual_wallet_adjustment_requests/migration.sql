CREATE TYPE "ManualWalletAdjustmentRequestStatus" AS ENUM (
  'REQUESTED',
  'EXECUTED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "ManualWalletAdjustmentRequest" (
  "id" TEXT NOT NULL,
  "ownerType" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "direction" TEXT NOT NULL,
  "adjustmentType" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "reason" TEXT NOT NULL,
  "monthlyPeriod" TEXT,
  "attachmentUrl" TEXT,
  "requestedBeforeBalance" INTEGER NOT NULL,
  "requestedAfterBalance" INTEGER NOT NULL,
  "requestedWalletDelta" INTEGER NOT NULL,
  "accountingPreview" JSONB NOT NULL,
  "affects" JSONB NOT NULL,
  "requiresAttachment" BOOLEAN NOT NULL DEFAULT false,
  "status" "ManualWalletAdjustmentRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedByAdminId" TEXT NOT NULL,
  "approvedByAdminId" TEXT,
  "rejectedByAdminId" TEXT,
  "decisionReason" TEXT,
  "ledgerEntryId" TEXT,
  "executedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ManualWalletAdjustmentRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ManualWalletAdjustmentRequest_status_createdAt_idx"
  ON "ManualWalletAdjustmentRequest"("status", "createdAt");

CREATE INDEX "ManualWalletAdjustmentRequest_ownerType_ownerId_status_createdAt_idx"
  ON "ManualWalletAdjustmentRequest"("ownerType", "ownerId", "status", "createdAt");

CREATE INDEX "ManualWalletAdjustmentRequest_requestedByAdminId_createdAt_idx"
  ON "ManualWalletAdjustmentRequest"("requestedByAdminId", "createdAt");

CREATE INDEX "ManualWalletAdjustmentRequest_monthlyPeriod_status_idx"
  ON "ManualWalletAdjustmentRequest"("monthlyPeriod", "status");

CREATE TYPE "PartnerBankDepositRequestStatus" AS ENUM (
  'REQUESTED',
  'EXECUTED',
  'REJECTED',
  'CANCELLED'
);

CREATE TABLE "PartnerBankDepositRequest" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "bankTransactionId" TEXT NOT NULL,
  "depositDate" TIMESTAMP(3) NOT NULL,
  "bankAccount" TEXT,
  "attachmentFileId" TEXT,
  "attachmentUrl" TEXT,
  "notes" TEXT,
  "requestedBeforeBalance" INTEGER NOT NULL,
  "requestedAfterBalance" INTEGER NOT NULL,
  "requestedReceivableRecovery" INTEGER NOT NULL,
  "requestedWalletLiabilityIncrease" INTEGER NOT NULL,
  "accountingPreview" JSONB NOT NULL,
  "status" "PartnerBankDepositRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestedByAdminId" TEXT NOT NULL,
  "approvedByAdminId" TEXT,
  "rejectedByAdminId" TEXT,
  "decisionReason" TEXT,
  "ledgerEntryId" TEXT,
  "journalBatchId" TEXT,
  "executedAllocation" JSONB,
  "executedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "PartnerBankDepositRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PartnerBankDepositRequest_status_createdAt_idx"
  ON "PartnerBankDepositRequest"("status", "createdAt");

CREATE INDEX "PartnerBankDepositRequest_providerProfileId_status_createdAt_idx"
  ON "PartnerBankDepositRequest"("providerProfileId", "status", "createdAt");

CREATE INDEX "PartnerBankDepositRequest_bankTransactionId_status_idx"
  ON "PartnerBankDepositRequest"("bankTransactionId", "status");

CREATE INDEX "PartnerBankDepositRequest_requestedByAdminId_createdAt_idx"
  ON "PartnerBankDepositRequest"("requestedByAdminId", "createdAt");

CREATE INDEX "PartnerBankDepositRequest_depositDate_status_idx"
  ON "PartnerBankDepositRequest"("depositDate", "status");

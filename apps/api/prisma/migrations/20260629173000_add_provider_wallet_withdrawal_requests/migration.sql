-- CreateEnum
CREATE TYPE "ProviderWalletWithdrawalRequestStatus" AS ENUM (
  'REQUESTED',
  'NEEDS_BANK_CORRECTION',
  'APPROVED',
  'PAID',
  'REJECTED',
  'CANCELLED'
);

-- AlterEnum
ALTER TYPE "ProviderWalletLedgerType" ADD VALUE 'PARTNER_WALLET_WITHDRAWAL_PAID';

-- CreateTable
CREATE TABLE "ProviderWalletWithdrawalRequest" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "bankAccountId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "ProviderWalletWithdrawalRequestStatus" NOT NULL DEFAULT 'REQUESTED',
  "requestNote" TEXT,
  "adminNote" TEXT,
  "correctionReason" TEXT,
  "transferRef" TEXT,
  "reviewedByAdminId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderWalletWithdrawalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderWalletWithdrawalRequest_providerProfileId_status_createdAt_idx"
  ON "ProviderWalletWithdrawalRequest"("providerProfileId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderWalletWithdrawalRequest_status_createdAt_idx"
  ON "ProviderWalletWithdrawalRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderWalletWithdrawalRequest_bankAccountId_idx"
  ON "ProviderWalletWithdrawalRequest"("bankAccountId");

-- AddForeignKey
ALTER TABLE "ProviderWalletWithdrawalRequest"
  ADD CONSTRAINT "ProviderWalletWithdrawalRequest_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderWalletWithdrawalRequest"
  ADD CONSTRAINT "ProviderWalletWithdrawalRequest_bankAccountId_fkey"
  FOREIGN KEY ("bankAccountId") REFERENCES "ProviderBankAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

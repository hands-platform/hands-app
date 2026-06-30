-- CreateEnum
CREATE TYPE "AccountingJournalSourceType" AS ENUM (
  'BOOKING_SETTLEMENT',
  'BOOKING_SETTLEMENT_REVERSAL',
  'MANUAL_WALLET_ADJUSTMENT',
  'PROVIDER_WITHDRAWAL',
  'PROVIDER_PAYOUT_BATCH',
  'PROVIDER_BANK_DEPOSIT',
  'REFERRAL_REWARD',
  'REFUND',
  'PAYMENT_CALLBACK',
  'BANK_RECONCILIATION_ADJUSTMENT'
);

-- CreateEnum
CREATE TYPE "AccountingJournalBatchStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED');

-- CreateEnum
CREATE TYPE "AccountingJournalEntrySide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "BookingPaymentClearingEntryType" AS ENUM (
  'CUSTOMER_PAYMENT_CAPTURED',
  'SETTLEMENT_POSTED',
  'REFUND_REVERSAL',
  'PAYMENT_FEE_ACCRUAL',
  'COUPON_OFFSET',
  'MANUAL_ADJUSTMENT'
);

-- CreateEnum
CREATE TYPE "BookingPaymentClearingStatus" AS ENUM ('OPEN', 'PARTIALLY_CLEARED', 'CLEARED', 'REVERSED');

-- CreateEnum
CREATE TYPE "CompanyBankAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'DISABLED');

-- CreateEnum
CREATE TYPE "CompanyBankTransactionType" AS ENUM ('INFLOW', 'OUTFLOW');

-- CreateEnum
CREATE TYPE "BankReconciliationStatus" AS ENUM ('UNMATCHED', 'MATCHED', 'PARTIALLY_MATCHED', 'IGNORED', 'REVERSED');

-- CreateTable
CREATE TABLE "AccountingJournalBatch" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "sourceType" "AccountingJournalSourceType" NOT NULL,
  "sourceId" TEXT NOT NULL,
  "bookingId" TEXT,
  "customerProfileId" TEXT,
  "providerProfileId" TEXT,
  "paymentId" TEXT,
  "settlementSnapshotId" TEXT,
  "settlementReversalEntryId" TEXT,
  "monthlyPeriod" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "AccountingJournalBatchStatus" NOT NULL DEFAULT 'POSTED',
  "totalDebit" INTEGER NOT NULL DEFAULT 0,
  "totalCredit" INTEGER NOT NULL DEFAULT 0,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountingJournalBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingJournalEntry" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "side" "AccountingJournalEntrySide" NOT NULL,
  "accountCode" TEXT NOT NULL,
  "accountName" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "memo" TEXT,
  "sourceType" "AccountingJournalSourceType",
  "sourceId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AccountingJournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingPaymentClearingEntry" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "type" "BookingPaymentClearingEntryType" NOT NULL,
  "status" "BookingPaymentClearingStatus" NOT NULL DEFAULT 'OPEN',
  "bookingId" TEXT NOT NULL,
  "paymentId" TEXT,
  "settlementSnapshotId" TEXT,
  "settlementReversalEntryId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "clearedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingPaymentClearingEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBankAccount" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "bankName" TEXT NOT NULL,
  "accountNumberMasked" TEXT,
  "accountNumberLast4" TEXT,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "CompanyBankAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyBankTransaction" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "bankAccountId" TEXT NOT NULL,
  "type" "CompanyBankTransactionType" NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "valueDate" TIMESTAMP(3),
  "transferRef" TEXT,
  "counterpartyName" TEXT,
  "description" TEXT,
  "status" "BankReconciliationStatus" NOT NULL DEFAULT 'UNMATCHED',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CompanyBankTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankReconciliationMatch" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "bankTransactionId" TEXT NOT NULL,
  "accountingJournalEntryId" TEXT,
  "paymentClearingEntryId" TEXT,
  "withdrawalRequestId" TEXT,
  "payoutBatchId" TEXT,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "BankReconciliationStatus" NOT NULL DEFAULT 'MATCHED',
  "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "matchedByAdminId" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BankReconciliationMatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountingJournalBatch_sourceKey_key" ON "AccountingJournalBatch"("sourceKey");
CREATE INDEX "AccountingJournalBatch_sourceType_sourceId_idx" ON "AccountingJournalBatch"("sourceType", "sourceId");
CREATE INDEX "AccountingJournalBatch_bookingId_postedAt_idx" ON "AccountingJournalBatch"("bookingId", "postedAt");
CREATE INDEX "AccountingJournalBatch_customerProfileId_postedAt_idx" ON "AccountingJournalBatch"("customerProfileId", "postedAt");
CREATE INDEX "AccountingJournalBatch_providerProfileId_postedAt_idx" ON "AccountingJournalBatch"("providerProfileId", "postedAt");
CREATE INDEX "AccountingJournalBatch_paymentId_idx" ON "AccountingJournalBatch"("paymentId");
CREATE INDEX "AccountingJournalBatch_settlementSnapshotId_idx" ON "AccountingJournalBatch"("settlementSnapshotId");
CREATE INDEX "AccountingJournalBatch_settlementReversalEntryId_idx" ON "AccountingJournalBatch"("settlementReversalEntryId");
CREATE INDEX "AccountingJournalBatch_monthlyPeriod_status_idx" ON "AccountingJournalBatch"("monthlyPeriod", "status");

CREATE INDEX "AccountingJournalEntry_batchId_idx" ON "AccountingJournalEntry"("batchId");
CREATE INDEX "AccountingJournalEntry_accountCode_createdAt_idx" ON "AccountingJournalEntry"("accountCode", "createdAt");
CREATE INDEX "AccountingJournalEntry_sourceType_sourceId_idx" ON "AccountingJournalEntry"("sourceType", "sourceId");

CREATE UNIQUE INDEX "BookingPaymentClearingEntry_sourceKey_key" ON "BookingPaymentClearingEntry"("sourceKey");
CREATE INDEX "BookingPaymentClearingEntry_bookingId_occurredAt_idx" ON "BookingPaymentClearingEntry"("bookingId", "occurredAt");
CREATE INDEX "BookingPaymentClearingEntry_paymentId_occurredAt_idx" ON "BookingPaymentClearingEntry"("paymentId", "occurredAt");
CREATE INDEX "BookingPaymentClearingEntry_settlementSnapshotId_idx" ON "BookingPaymentClearingEntry"("settlementSnapshotId");
CREATE INDEX "BookingPaymentClearingEntry_settlementReversalEntryId_idx" ON "BookingPaymentClearingEntry"("settlementReversalEntryId");
CREATE INDEX "BookingPaymentClearingEntry_status_occurredAt_idx" ON "BookingPaymentClearingEntry"("status", "occurredAt");
CREATE INDEX "BookingPaymentClearingEntry_type_occurredAt_idx" ON "BookingPaymentClearingEntry"("type", "occurredAt");

CREATE INDEX "CompanyBankAccount_status_currency_idx" ON "CompanyBankAccount"("status", "currency");

CREATE UNIQUE INDEX "CompanyBankTransaction_sourceKey_key" ON "CompanyBankTransaction"("sourceKey");
CREATE INDEX "CompanyBankTransaction_bankAccountId_occurredAt_idx" ON "CompanyBankTransaction"("bankAccountId", "occurredAt");
CREATE INDEX "CompanyBankTransaction_status_occurredAt_idx" ON "CompanyBankTransaction"("status", "occurredAt");
CREATE INDEX "CompanyBankTransaction_transferRef_idx" ON "CompanyBankTransaction"("transferRef");

CREATE UNIQUE INDEX "BankReconciliationMatch_sourceKey_key" ON "BankReconciliationMatch"("sourceKey");
CREATE INDEX "BankReconciliationMatch_bankTransactionId_status_idx" ON "BankReconciliationMatch"("bankTransactionId", "status");
CREATE INDEX "BankReconciliationMatch_accountingJournalEntryId_idx" ON "BankReconciliationMatch"("accountingJournalEntryId");
CREATE INDEX "BankReconciliationMatch_paymentClearingEntryId_idx" ON "BankReconciliationMatch"("paymentClearingEntryId");
CREATE INDEX "BankReconciliationMatch_withdrawalRequestId_idx" ON "BankReconciliationMatch"("withdrawalRequestId");
CREATE INDEX "BankReconciliationMatch_payoutBatchId_idx" ON "BankReconciliationMatch"("payoutBatchId");
CREATE INDEX "BankReconciliationMatch_matchedByAdminId_matchedAt_idx" ON "BankReconciliationMatch"("matchedByAdminId", "matchedAt");

-- AddForeignKey
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_settlementSnapshotId_fkey" FOREIGN KEY ("settlementSnapshotId") REFERENCES "BookingSettlementSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_settlementReversalEntryId_fkey" FOREIGN KEY ("settlementReversalEntryId") REFERENCES "BookingSettlementReversalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AccountingJournalBatch" ADD CONSTRAINT "AccountingJournalBatch_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AccountingJournalEntry" ADD CONSTRAINT "AccountingJournalEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "AccountingJournalBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BookingPaymentClearingEntry" ADD CONSTRAINT "BookingPaymentClearingEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingPaymentClearingEntry" ADD CONSTRAINT "BookingPaymentClearingEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingPaymentClearingEntry" ADD CONSTRAINT "BookingPaymentClearingEntry_settlementSnapshotId_fkey" FOREIGN KEY ("settlementSnapshotId") REFERENCES "BookingSettlementSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BookingPaymentClearingEntry" ADD CONSTRAINT "BookingPaymentClearingEntry_settlementReversalEntryId_fkey" FOREIGN KEY ("settlementReversalEntryId") REFERENCES "BookingSettlementReversalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyBankTransaction" ADD CONSTRAINT "CompanyBankTransaction_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CompanyBankAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "CompanyBankTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_accountingJournalEntryId_fkey" FOREIGN KEY ("accountingJournalEntryId") REFERENCES "AccountingJournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_paymentClearingEntryId_fkey" FOREIGN KEY ("paymentClearingEntryId") REFERENCES "BookingPaymentClearingEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "ProviderWalletWithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_payoutBatchId_fkey" FOREIGN KEY ("payoutBatchId") REFERENCES "ProviderPayoutBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BankReconciliationMatch" ADD CONSTRAINT "BankReconciliationMatch_matchedByAdminId_fkey" FOREIGN KEY ("matchedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

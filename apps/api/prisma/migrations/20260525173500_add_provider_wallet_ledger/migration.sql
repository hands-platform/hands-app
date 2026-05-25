CREATE TYPE "ProviderWalletLedgerType" AS ENUM (
  'BOOKING_EARNING',
  'CASH_FEE_DEBT_SETTLED',
  'PAYOUT_PAID',
  'REFUND_REVERSAL',
  'ADMIN_ADJUSTMENT'
);

CREATE TABLE "ProviderWalletLedgerEntry" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "bookingId" TEXT,
  "earningId" TEXT,
  "payoutBatchId" TEXT,
  "type" "ProviderWalletLedgerType" NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "reference" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderWalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderWalletLedgerEntry_sourceKey_key" ON "ProviderWalletLedgerEntry"("sourceKey");
CREATE INDEX "ProviderWalletLedgerEntry_providerProfileId_createdAt_idx" ON "ProviderWalletLedgerEntry"("providerProfileId", "createdAt");
CREATE INDEX "ProviderWalletLedgerEntry_bookingId_idx" ON "ProviderWalletLedgerEntry"("bookingId");
CREATE INDEX "ProviderWalletLedgerEntry_earningId_idx" ON "ProviderWalletLedgerEntry"("earningId");
CREATE INDEX "ProviderWalletLedgerEntry_payoutBatchId_idx" ON "ProviderWalletLedgerEntry"("payoutBatchId");
CREATE INDEX "ProviderWalletLedgerEntry_type_createdAt_idx" ON "ProviderWalletLedgerEntry"("type", "createdAt");

ALTER TABLE "ProviderWalletLedgerEntry"
  ADD CONSTRAINT "ProviderWalletLedgerEntry_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProviderWalletLedgerEntry"
  ADD CONSTRAINT "ProviderWalletLedgerEntry_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderWalletLedgerEntry"
  ADD CONSTRAINT "ProviderWalletLedgerEntry_earningId_fkey"
  FOREIGN KEY ("earningId") REFERENCES "ProviderEarning"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProviderWalletLedgerEntry"
  ADD CONSTRAINT "ProviderWalletLedgerEntry_payoutBatchId_fkey"
  FOREIGN KEY ("payoutBatchId") REFERENCES "ProviderPayoutBatch"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

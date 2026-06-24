CREATE TYPE "CustomerWalletLedgerType" AS ENUM (
  'REFERRAL_REWARD',
  'REFUND',
  'ADMIN_ADJUSTMENT'
);

CREATE TABLE "CustomerWalletLedgerEntry" (
  "id" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "bookingId" TEXT,
  "referralRewardId" TEXT,
  "type" "CustomerWalletLedgerType" NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "reference" TEXT,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CustomerWalletLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomerWalletLedgerEntry_sourceKey_key" ON "CustomerWalletLedgerEntry"("sourceKey");
CREATE INDEX "CustomerWalletLedgerEntry_customerProfileId_createdAt_idx" ON "CustomerWalletLedgerEntry"("customerProfileId", "createdAt");
CREATE INDEX "CustomerWalletLedgerEntry_bookingId_idx" ON "CustomerWalletLedgerEntry"("bookingId");
CREATE INDEX "CustomerWalletLedgerEntry_referralRewardId_idx" ON "CustomerWalletLedgerEntry"("referralRewardId");
CREATE INDEX "CustomerWalletLedgerEntry_type_createdAt_idx" ON "CustomerWalletLedgerEntry"("type", "createdAt");

ALTER TABLE "CustomerWalletLedgerEntry"
  ADD CONSTRAINT "CustomerWalletLedgerEntry_customerProfileId_fkey"
  FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CustomerWalletLedgerEntry"
  ADD CONSTRAINT "CustomerWalletLedgerEntry_bookingId_fkey"
  FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CustomerWalletLedgerEntry"
  ADD CONSTRAINT "CustomerWalletLedgerEntry_referralRewardId_fkey"
  FOREIGN KEY ("referralRewardId") REFERENCES "ReferralReward"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "BookingSettlementReversalEntry" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
  "originalSettlementSnapshotId" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "customerProfileId" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "paymentId" TEXT,
  "providerEarningId" TEXT,
  "paymentMethod" "PaymentMethod" NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "customerPaymentAmount" INTEGER NOT NULL,
  "partnerPayoutAmount" INTEGER NOT NULL,
  "partnerTaxableRevenue" INTEGER NOT NULL,
  "partnerVatAmount" INTEGER NOT NULL DEFAULT 0,
  "partnerPitAmount" INTEGER NOT NULL DEFAULT 0,
  "partnerWithholdingTotal" INTEGER NOT NULL DEFAULT 0,
  "platformFeeGross" INTEGER NOT NULL,
  "platformFeeNetRevenue" INTEGER NOT NULL,
  "companyOutputVat" INTEGER NOT NULL DEFAULT 0,
  "paymentProcessingFee" INTEGER NOT NULL DEFAULT 0,
  "settlementStatus" "BookingSettlementStatus" NOT NULL DEFAULT 'REVERSED',
  "taxStatus" "BookingSettlementTaxStatus" NOT NULL DEFAULT 'REVERSED',
  "monthlyPeriod" TEXT NOT NULL,
  "originalMonthlyPeriod" TEXT NOT NULL,
  "originalMonthlyClosingId" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "createdById" TEXT,
  "reason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingSettlementReversalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementReversalEntry_sourceKey_key" ON "BookingSettlementReversalEntry"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementReversalEntry_originalSettlementSnapshotId_key" ON "BookingSettlementReversalEntry"("originalSettlementSnapshotId");

-- CreateIndex
CREATE INDEX "BookingSettlementReversalEntry_bookingId_occurredAt_idx" ON "BookingSettlementReversalEntry"("bookingId", "occurredAt");

-- CreateIndex
CREATE INDEX "BookingSettlementReversalEntry_monthlyPeriod_taxStatus_idx" ON "BookingSettlementReversalEntry"("monthlyPeriod", "taxStatus");

-- CreateIndex
CREATE INDEX "BookingSettlementReversalEntry_settlementStatus_occurredAt_idx" ON "BookingSettlementReversalEntry"("settlementStatus", "occurredAt");

-- CreateIndex
CREATE INDEX "BookingSettlementReversalEntry_originalMonthlyClosingId_idx" ON "BookingSettlementReversalEntry"("originalMonthlyClosingId");

-- AddForeignKey
ALTER TABLE "BookingSettlementReversalEntry"
ADD CONSTRAINT "BookingSettlementReversalEntry_originalSettlementSnapshotId_fkey"
FOREIGN KEY ("originalSettlementSnapshotId") REFERENCES "BookingSettlementSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

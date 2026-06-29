-- CreateEnum
CREATE TYPE "PartnerTaxLineKind" AS ENUM (
  'PARTNER_WITHHOLDING_COMBINED',
  'PARTNER_VAT',
  'PARTNER_PIT'
);

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CARD';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'BANK_TRANSFER';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'CUSTOMER_WALLET';
ALTER TYPE "PaymentMethod" ADD VALUE IF NOT EXISTS 'MANUAL';

-- CreateEnum
CREATE TYPE "PaymentFeeRuleType" AS ENUM (
  'RATE',
  'FIXED',
  'RATE_PLUS_FIXED'
);

-- CreateEnum
CREATE TYPE "PaymentFeePayer" AS ENUM (
  'HANDS',
  'CUSTOMER',
  'PARTNER',
  'SHARED'
);

-- CreateEnum
CREATE TYPE "PaymentFeeTreatment" AS ENUM (
  'OPERATING_EXPENSE',
  'PASS_THROUGH',
  'MANUAL_REVIEW'
);

-- CreateEnum
CREATE TYPE "BookingSettlementStatus" AS ENUM (
  'DRAFT',
  'POSTED',
  'REVERSED'
);

-- CreateEnum
CREATE TYPE "BookingSettlementTaxStatus" AS ENUM (
  'OPEN',
  'DECLARED',
  'PAID',
  'CLOSED',
  'REVERSED'
);

-- CreateEnum
CREATE TYPE "MonthlyTaxClosingStatus" AS ENUM (
  'DRAFT',
  'REVIEWED',
  'DECLARED',
  'PAID',
  'CLOSED',
  'REVERSED'
);

-- AlterTable
ALTER TABLE "TaxRule"
ADD COLUMN "taxKind" "PartnerTaxLineKind" NOT NULL DEFAULT 'PARTNER_WITHHOLDING_COMBINED',
ADD COLUMN "category" TEXT,
ADD COLUMN "collectionMode" TEXT;

-- AlterTable
ALTER TABLE "ProviderTaxLog"
ADD COLUMN "taxKind" "PartnerTaxLineKind" NOT NULL DEFAULT 'PARTNER_WITHHOLDING_COMBINED';

-- AlterTable
ALTER TABLE "PlatformFeePolicyVersion"
ADD COLUMN "vatRateBps" INTEGER NOT NULL DEFAULT 800,
ADD COLUMN "vatCategory" TEXT;

-- CreateTable
CREATE TABLE "PaymentFeePolicyVersion" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "TaxPolicyStatus" NOT NULL DEFAULT 'DRAFT',
  "effectiveFrom" TIMESTAMP(3) NOT NULL,
  "effectiveTo" TIMESTAMP(3),
  "notes" TEXT,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentFeePolicyVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentFeeRule" (
  "id" TEXT NOT NULL,
  "policyVersionId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "feeType" "PaymentFeeRuleType" NOT NULL DEFAULT 'RATE',
  "rateBps" INTEGER NOT NULL DEFAULT 0,
  "fixedAmount" INTEGER NOT NULL DEFAULT 0,
  "payer" "PaymentFeePayer" NOT NULL DEFAULT 'HANDS',
  "treatment" "PaymentFeeTreatment" NOT NULL DEFAULT 'OPERATING_EXPENSE',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "PaymentFeeRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonthlyTaxClosing" (
  "id" TEXT NOT NULL,
  "period" TEXT NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'VND',
  "status" "MonthlyTaxClosingStatus" NOT NULL DEFAULT 'DRAFT',
  "platformFeeGrossTotal" INTEGER NOT NULL DEFAULT 0,
  "platformFeeNetRevenueTotal" INTEGER NOT NULL DEFAULT 0,
  "companyOutputVatTotal" INTEGER NOT NULL DEFAULT 0,
  "partnerVatWithheldTotal" INTEGER NOT NULL DEFAULT 0,
  "partnerPitWithheldTotal" INTEGER NOT NULL DEFAULT 0,
  "partnerWithholdingTotal" INTEGER NOT NULL DEFAULT 0,
  "paymentProcessingFeeTotal" INTEGER NOT NULL DEFAULT 0,
  "cashDebtTotal" INTEGER NOT NULL DEFAULT 0,
  "nonCashPartnerPayoutTotal" INTEGER NOT NULL DEFAULT 0,
  "settlementCount" INTEGER NOT NULL DEFAULT 0,
  "declaredAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdById" TEXT,
  "reviewedById" TEXT,
  "declaredById" TEXT,
  "paidById" TEXT,
  "closedById" TEXT,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MonthlyTaxClosing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingSettlementSnapshot" (
  "id" TEXT NOT NULL,
  "sourceKey" TEXT NOT NULL,
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
  "partnerVatRateBps" INTEGER NOT NULL DEFAULT 0,
  "partnerVatAmount" INTEGER NOT NULL DEFAULT 0,
  "partnerPitRateBps" INTEGER NOT NULL DEFAULT 0,
  "partnerPitAmount" INTEGER NOT NULL DEFAULT 0,
  "partnerWithholdingTotal" INTEGER NOT NULL DEFAULT 0,
  "platformFeeGross" INTEGER NOT NULL,
  "platformVatRateBps" INTEGER NOT NULL DEFAULT 0,
  "platformFeeNetRevenue" INTEGER NOT NULL,
  "companyOutputVat" INTEGER NOT NULL DEFAULT 0,
  "paymentFeePolicyVersionId" TEXT,
  "paymentFeeRateBps" INTEGER NOT NULL DEFAULT 0,
  "paymentFeeFixedAmount" INTEGER NOT NULL DEFAULT 0,
  "paymentProcessingFee" INTEGER NOT NULL DEFAULT 0,
  "paymentFeePayer" "PaymentFeePayer" NOT NULL DEFAULT 'HANDS',
  "paymentFeeTreatment" "PaymentFeeTreatment" NOT NULL DEFAULT 'OPERATING_EXPENSE',
  "taxPolicyVersionId" TEXT,
  "platformFeePolicyVersionId" TEXT,
  "taxRuleSnapshot" JSONB,
  "platformFeeRuleSnapshot" JSONB,
  "paymentFeeRuleSnapshot" JSONB,
  "providerTaxLogIds" JSONB,
  "providerPlatformFeeLogId" TEXT,
  "providerWalletLedgerEntryIds" JSONB,
  "customerWalletLedgerEntryIds" JSONB,
  "settlementStatus" "BookingSettlementStatus" NOT NULL DEFAULT 'POSTED',
  "taxStatus" "BookingSettlementTaxStatus" NOT NULL DEFAULT 'OPEN',
  "monthlyPeriod" TEXT NOT NULL,
  "monthlyClosingId" TEXT,
  "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt" TIMESTAMP(3),
  "reversalOfId" TEXT,
  "reversedById" TEXT,
  "reversalReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BookingSettlementSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentFeePolicyVersion_status_effectiveFrom_idx" ON "PaymentFeePolicyVersion"("status", "effectiveFrom");

-- CreateIndex
CREATE INDEX "PaymentFeeRule_policyVersionId_method_active_idx" ON "PaymentFeeRule"("policyVersionId", "method", "active");

-- CreateIndex
CREATE UNIQUE INDEX "MonthlyTaxClosing_period_currency_key" ON "MonthlyTaxClosing"("period", "currency");

-- CreateIndex
CREATE INDEX "MonthlyTaxClosing_status_period_idx" ON "MonthlyTaxClosing"("status", "period");

-- CreateIndex
CREATE INDEX "MonthlyTaxClosing_currency_period_idx" ON "MonthlyTaxClosing"("currency", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementSnapshot_sourceKey_key" ON "BookingSettlementSnapshot"("sourceKey");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementSnapshot_bookingId_key" ON "BookingSettlementSnapshot"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementSnapshot_paymentId_key" ON "BookingSettlementSnapshot"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementSnapshot_providerEarningId_key" ON "BookingSettlementSnapshot"("providerEarningId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingSettlementSnapshot_reversalOfId_key" ON "BookingSettlementSnapshot"("reversalOfId");

-- CreateIndex
CREATE INDEX "BookingSettlementSnapshot_customerProfileId_postedAt_idx" ON "BookingSettlementSnapshot"("customerProfileId", "postedAt");

-- CreateIndex
CREATE INDEX "BookingSettlementSnapshot_providerProfileId_postedAt_idx" ON "BookingSettlementSnapshot"("providerProfileId", "postedAt");

-- CreateIndex
CREATE INDEX "BookingSettlementSnapshot_monthlyPeriod_taxStatus_idx" ON "BookingSettlementSnapshot"("monthlyPeriod", "taxStatus");

-- CreateIndex
CREATE INDEX "BookingSettlementSnapshot_settlementStatus_postedAt_idx" ON "BookingSettlementSnapshot"("settlementStatus", "postedAt");

-- CreateIndex
CREATE INDEX "BookingSettlementSnapshot_paymentMethod_postedAt_idx" ON "BookingSettlementSnapshot"("paymentMethod", "postedAt");

-- CreateIndex
CREATE INDEX "BookingSettlementSnapshot_monthlyClosingId_idx" ON "BookingSettlementSnapshot"("monthlyClosingId");

-- AddForeignKey
ALTER TABLE "PaymentFeePolicyVersion"
ADD CONSTRAINT "PaymentFeePolicyVersion_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentFeeRule"
ADD CONSTRAINT "PaymentFeeRule_policyVersionId_fkey"
FOREIGN KEY ("policyVersionId") REFERENCES "PaymentFeePolicyVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_bookingId_fkey"
FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_providerEarningId_fkey"
FOREIGN KEY ("providerEarningId") REFERENCES "ProviderEarning"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_taxPolicyVersionId_fkey"
FOREIGN KEY ("taxPolicyVersionId") REFERENCES "TaxPolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_platformFeePolicyVersionId_fkey"
FOREIGN KEY ("platformFeePolicyVersionId") REFERENCES "PlatformFeePolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_paymentFeePolicyVersionId_fkey"
FOREIGN KEY ("paymentFeePolicyVersionId") REFERENCES "PaymentFeePolicyVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_monthlyClosingId_fkey"
FOREIGN KEY ("monthlyClosingId") REFERENCES "MonthlyTaxClosing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingSettlementSnapshot"
ADD CONSTRAINT "BookingSettlementSnapshot_reversalOfId_fkey"
FOREIGN KEY ("reversalOfId") REFERENCES "BookingSettlementSnapshot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

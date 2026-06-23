-- CreateEnum
CREATE TYPE "ReferralAudience" AS ENUM ('CUSTOMER', 'PARTNER');

-- CreateEnum
CREATE TYPE "ReferralRewardMode" AS ENUM ('COMMISSION_PERCENT', 'FIXED_AMOUNT');

-- CreateEnum
CREATE TYPE "ReferralAttributionStatus" AS ENUM ('REGISTERED', 'QUALIFIED', 'REWARDED', 'BLOCKED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReferralFraudReviewStatus" AS ENUM ('CLEAR', 'FLAGGED', 'HELD');

-- CreateEnum
CREATE TYPE "ReferralRewardStatus" AS ENUM ('PENDING', 'AVAILABLE', 'HELD', 'REVERSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ReferralPolicy" (
    "id" TEXT NOT NULL,
    "audience" "ReferralAudience" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "rewardMode" "ReferralRewardMode" NOT NULL,
    "commissionPercentBps" INTEGER,
    "fixedRewardAmount" INTEGER,
    "perRewardCapAmount" INTEGER,
    "totalRewardCapAmount" INTEGER,
    "maxRewardedReferrals" INTEGER,
    "maxRewardsPerReferred" INTEGER,
    "holdPeriodDays" INTEGER NOT NULL DEFAULT 7,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralCode" (
    "id" TEXT NOT NULL,
    "audience" "ReferralAudience" NOT NULL,
    "code" TEXT NOT NULL,
    "ownerCustomerProfileId" TEXT,
    "ownerProviderProfileId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralAttribution" (
    "id" TEXT NOT NULL,
    "audience" "ReferralAudience" NOT NULL,
    "referralCodeId" TEXT NOT NULL,
    "referrerCustomerProfileId" TEXT,
    "referrerProviderProfileId" TEXT,
    "referredCustomerProfileId" TEXT,
    "referredProviderProfileId" TEXT,
    "installSource" TEXT,
    "platform" TEXT,
    "status" "ReferralAttributionStatus" NOT NULL DEFAULT 'REGISTERED',
    "fraudReviewStatus" "ReferralFraudReviewStatus" NOT NULL DEFAULT 'CLEAR',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferralReward" (
    "id" TEXT NOT NULL,
    "attributionId" TEXT NOT NULL,
    "qualifyingBookingId" TEXT,
    "walletOwnerCustomerProfileId" TEXT,
    "walletOwnerProviderProfileId" TEXT,
    "sourceKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "status" "ReferralRewardStatus" NOT NULL DEFAULT 'PENDING',
    "calculationSnapshot" JSONB NOT NULL,
    "walletLedgerReference" TEXT,
    "availableAt" TIMESTAMP(3),
    "heldAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferralReward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReferralPolicy_audience_key" ON "ReferralPolicy"("audience");

-- CreateIndex
CREATE INDEX "ReferralPolicy_enabled_audience_idx" ON "ReferralPolicy"("enabled", "audience");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_code_key" ON "ReferralCode"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_audience_ownerCustomerProfileId_key" ON "ReferralCode"("audience", "ownerCustomerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralCode_audience_ownerProviderProfileId_key" ON "ReferralCode"("audience", "ownerProviderProfileId");

-- CreateIndex
CREATE INDEX "ReferralCode_audience_active_idx" ON "ReferralCode"("audience", "active");

-- CreateIndex
CREATE INDEX "ReferralCode_ownerCustomerProfileId_idx" ON "ReferralCode"("ownerCustomerProfileId");

-- CreateIndex
CREATE INDEX "ReferralCode_ownerProviderProfileId_idx" ON "ReferralCode"("ownerProviderProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_audience_referredCustomerProfileId_key" ON "ReferralAttribution"("audience", "referredCustomerProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralAttribution_audience_referredProviderProfileId_key" ON "ReferralAttribution"("audience", "referredProviderProfileId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_audience_status_createdAt_idx" ON "ReferralAttribution"("audience", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referralCodeId_idx" ON "ReferralAttribution"("referralCodeId");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referrerCustomerProfileId_createdAt_idx" ON "ReferralAttribution"("referrerCustomerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralAttribution_referrerProviderProfileId_createdAt_idx" ON "ReferralAttribution"("referrerProviderProfileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReferralReward_sourceKey_key" ON "ReferralReward"("sourceKey");

-- CreateIndex
CREATE INDEX "ReferralReward_status_createdAt_idx" ON "ReferralReward"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_attributionId_idx" ON "ReferralReward"("attributionId");

-- CreateIndex
CREATE INDEX "ReferralReward_qualifyingBookingId_idx" ON "ReferralReward"("qualifyingBookingId");

-- CreateIndex
CREATE INDEX "ReferralReward_walletOwnerCustomerProfileId_createdAt_idx" ON "ReferralReward"("walletOwnerCustomerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ReferralReward_walletOwnerProviderProfileId_createdAt_idx" ON "ReferralReward"("walletOwnerProviderProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerCustomerProfileId_fkey" FOREIGN KEY ("ownerCustomerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralCode" ADD CONSTRAINT "ReferralCode_ownerProviderProfileId_fkey" FOREIGN KEY ("ownerProviderProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referralCodeId_fkey" FOREIGN KEY ("referralCodeId") REFERENCES "ReferralCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerCustomerProfileId_fkey" FOREIGN KEY ("referrerCustomerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referrerProviderProfileId_fkey" FOREIGN KEY ("referrerProviderProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredCustomerProfileId_fkey" FOREIGN KEY ("referredCustomerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_referredProviderProfileId_fkey" FOREIGN KEY ("referredProviderProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ReferralAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_qualifyingBookingId_fkey" FOREIGN KEY ("qualifyingBookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_walletOwnerCustomerProfileId_fkey" FOREIGN KEY ("walletOwnerCustomerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralReward" ADD CONSTRAINT "ReferralReward_walletOwnerProviderProfileId_fkey" FOREIGN KEY ("walletOwnerProviderProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "MarketingSpendDaily" (
    "id" TEXT NOT NULL,
    "spendDate" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL,
    "platform" TEXT NOT NULL DEFAULT 'unknown',
    "regionCode" TEXT NOT NULL DEFAULT 'all',
    "campaignId" TEXT NOT NULL DEFAULT 'all',
    "campaignName" TEXT,
    "spendAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "notes" TEXT,
    "metadata" JSONB,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingSpendDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSpendDaily_spendDate_source_platform_regionCode_campaignId_key" ON "MarketingSpendDaily"("spendDate", "source", "platform", "regionCode", "campaignId");

-- CreateIndex
CREATE INDEX "MarketingSpendDaily_spendDate_source_platform_idx" ON "MarketingSpendDaily"("spendDate", "source", "platform");

-- CreateIndex
CREATE INDEX "MarketingSpendDaily_campaignId_spendDate_idx" ON "MarketingSpendDaily"("campaignId", "spendDate");

-- CreateIndex
CREATE INDEX "MarketingSpendDaily_regionCode_spendDate_idx" ON "MarketingSpendDaily"("regionCode", "spendDate");

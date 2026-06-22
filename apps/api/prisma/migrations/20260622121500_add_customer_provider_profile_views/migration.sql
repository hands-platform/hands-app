-- CreateTable
CREATE TABLE "CustomerProviderProfileView" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "firstViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "viewCount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProviderProfileView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProviderProfileView_customerProfileId_providerProfileId_key" ON "CustomerProviderProfileView"("customerProfileId", "providerProfileId");

-- CreateIndex
CREATE INDEX "CustomerProviderProfileView_customerProfileId_lastViewedAt_idx" ON "CustomerProviderProfileView"("customerProfileId", "lastViewedAt");

-- CreateIndex
CREATE INDEX "CustomerProviderProfileView_providerProfileId_lastViewedAt_idx" ON "CustomerProviderProfileView"("providerProfileId", "lastViewedAt");

-- AddForeignKey
ALTER TABLE "CustomerProviderProfileView" ADD CONSTRAINT "CustomerProviderProfileView_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProviderProfileView" ADD CONSTRAINT "CustomerProviderProfileView_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

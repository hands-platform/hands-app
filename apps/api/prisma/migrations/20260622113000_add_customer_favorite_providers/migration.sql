-- CreateTable
CREATE TABLE "CustomerFavoriteProvider" (
    "id" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerFavoriteProvider_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerFavoriteProvider_customerProfileId_providerProfileId_key" ON "CustomerFavoriteProvider"("customerProfileId", "providerProfileId");

-- CreateIndex
CREATE INDEX "CustomerFavoriteProvider_customerProfileId_createdAt_idx" ON "CustomerFavoriteProvider"("customerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerFavoriteProvider_providerProfileId_createdAt_idx" ON "CustomerFavoriteProvider"("providerProfileId", "createdAt");

-- AddForeignKey
ALTER TABLE "CustomerFavoriteProvider"
ADD CONSTRAINT "CustomerFavoriteProvider_customerProfileId_fkey"
FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerFavoriteProvider"
ADD CONSTRAINT "CustomerFavoriteProvider_providerProfileId_fkey"
FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

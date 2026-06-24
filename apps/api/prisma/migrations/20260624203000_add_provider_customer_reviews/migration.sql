-- CreateTable
CREATE TABLE "ProviderCustomerReview" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "comment" TEXT,
    "status" "ReviewStatus" NOT NULL DEFAULT 'PUBLISHED',
    "reportReason" TEXT,
    "moderatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderCustomerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderCustomerReview_bookingId_key" ON "ProviderCustomerReview"("bookingId");

-- CreateIndex
CREATE INDEX "ProviderCustomerReview_customerProfileId_createdAt_idx" ON "ProviderCustomerReview"("customerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCustomerReview_providerProfileId_createdAt_idx" ON "ProviderCustomerReview"("providerProfileId", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderCustomerReview_status_createdAt_idx" ON "ProviderCustomerReview"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "ProviderCustomerReview" ADD CONSTRAINT "ProviderCustomerReview_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCustomerReview" ADD CONSTRAINT "ProviderCustomerReview_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderCustomerReview" ADD CONSTRAINT "ProviderCustomerReview_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

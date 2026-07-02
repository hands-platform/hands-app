-- CreateTable
CREATE TABLE "ProviderBookingRequestEvent" (
    "id" TEXT NOT NULL,
    "providerProfileId" TEXT NOT NULL,
    "bookingId" TEXT,
    "eventType" TEXT NOT NULL,
    "visibleBookingCount" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderBookingRequestEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderBookingRequestEvent_eventType_createdAt_idx" ON "ProviderBookingRequestEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderBookingRequestEvent_providerProfileId_eventType_createdAt_idx" ON "ProviderBookingRequestEvent"("providerProfileId", "eventType", "createdAt");

-- CreateIndex
CREATE INDEX "ProviderBookingRequestEvent_bookingId_eventType_createdAt_idx" ON "ProviderBookingRequestEvent"("bookingId", "eventType", "createdAt");

-- AddForeignKey
ALTER TABLE "ProviderBookingRequestEvent" ADD CONSTRAINT "ProviderBookingRequestEvent_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProviderBookingRequestEvent" ADD CONSTRAINT "ProviderBookingRequestEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

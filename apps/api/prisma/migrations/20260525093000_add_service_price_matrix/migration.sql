ALTER TABLE "MassageService"
ADD COLUMN "serviceGroupKey" TEXT,
ADD COLUMN "priceStep" INTEGER NOT NULL DEFAULT 100000,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ServicePayoutRule" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "customerPrice" INTEGER NOT NULL,
    "providerPayoutAmount" INTEGER NOT NULL,
    "vatBps" INTEGER NOT NULL DEFAULT 0,
    "otherCostAmount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'VND',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServicePayoutRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "MassageService_serviceGroupKey_durationMin_idx" ON "MassageService"("serviceGroupKey", "durationMin");
CREATE INDEX "MassageService_active_displayOrder_idx" ON "MassageService"("active", "displayOrder");
CREATE UNIQUE INDEX "ServicePayoutRule_serviceId_customerPrice_key" ON "ServicePayoutRule"("serviceId", "customerPrice");
CREATE INDEX "ServicePayoutRule_serviceId_active_idx" ON "ServicePayoutRule"("serviceId", "active");

ALTER TABLE "ServicePayoutRule" ADD CONSTRAINT "ServicePayoutRule_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "MassageService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

UPDATE "MassageService"
SET "serviceGroupKey" = CASE
    WHEN lower("name") LIKE '%swedish%' THEN 'swedish'
    WHEN lower("name") LIKE '%deep%' THEN 'deep_tissue'
    WHEN lower("name") LIKE '%foot%' THEN 'foot'
    ELSE lower(regexp_replace("name", '[^a-zA-Z0-9]+', '_', 'g'))
END,
"displayOrder" = CASE
    WHEN lower("name") LIKE '%foot%' THEN 10
    WHEN lower("name") LIKE '%swedish%' THEN 20
    WHEN lower("name") LIKE '%deep%' THEN 30
    ELSE 100
END;

INSERT INTO "ServicePayoutRule" (
    "id",
    "serviceId",
    "customerPrice",
    "providerPayoutAmount",
    "vatBps",
    "otherCostAmount",
    "currency",
    "active",
    "notes",
    "createdAt",
    "updatedAt"
)
SELECT
    'service-payout-' || "id" || '-' || "basePrice",
    "id",
    "basePrice",
    GREATEST(0, "basePrice" - ROUND("basePrice" * 0.20)::INTEGER),
    0,
    0,
    'VND',
    true,
    'Default MVP payout rule generated from the previous 20% platform fee.',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "MassageService"
ON CONFLICT ("serviceId", "customerPrice") DO NOTHING;

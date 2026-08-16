CREATE TYPE "ServicePublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'ARCHIVED');
CREATE TYPE "ServiceCatalogProvenance" AS ENUM ('OPERATOR', 'SEED', 'SMOKE_TEST', 'MIGRATION');

ALTER TABLE "MassageService"
ADD COLUMN "publicationStatus" "ServicePublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "provenance" "ServiceCatalogProvenance" NOT NULL DEFAULT 'OPERATOR',
ADD COLUMN "provenanceRunId" TEXT,
ADD COLUMN "catalogVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "lastMutationKey" TEXT,
ADD COLUMN "lastMutationHash" TEXT,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedById" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "MassageService"
SET
  "provenance" = CASE
    WHEN lower(coalesce("serviceGroupKey", '') || ' ' || "name") ~ '(smoke|test|[0-9]{10,})'
      THEN 'SMOKE_TEST'::"ServiceCatalogProvenance"
    WHEN "serviceGroupKey" IN ('foot', 'swedish', 'deep_tissue')
      THEN 'SEED'::"ServiceCatalogProvenance"
    ELSE 'MIGRATION'::"ServiceCatalogProvenance"
  END,
  "publicationStatus" = CASE
    WHEN "serviceGroupKey" IN ('foot', 'swedish', 'deep_tissue')
      AND "durationMin" IN (60, 90, 120)
      AND "active" = true
      AND EXISTS (
        SELECT 1
        FROM "ServicePayoutRule" payout
        WHERE payout."serviceId" = "MassageService"."id"
          AND payout."customerPrice" = "MassageService"."basePrice"
          AND payout."active" = true
          AND payout."providerPayoutAmount" <= payout."customerPrice"
      )
      THEN 'PUBLISHED'::"ServicePublicationStatus"
    ELSE 'HIDDEN'::"ServicePublicationStatus"
  END,
  "publishedAt" = CASE
    WHEN "serviceGroupKey" IN ('foot', 'swedish', 'deep_tissue')
      AND "durationMin" IN (60, 90, 120)
      AND "active" = true
      AND EXISTS (
        SELECT 1
        FROM "ServicePayoutRule" payout
        WHERE payout."serviceId" = "MassageService"."id"
          AND payout."customerPrice" = "MassageService"."basePrice"
          AND payout."active" = true
          AND payout."providerPayoutAmount" <= payout."customerPrice"
      )
      THEN CURRENT_TIMESTAMP
    ELSE NULL
  END;

CREATE INDEX "MassageService_publicationStatus_active_displayOrder_idx"
ON "MassageService"("publicationStatus", "active", "displayOrder");
CREATE UNIQUE INDEX "MassageService_serviceGroupKey_durationMin_key"
ON "MassageService"("serviceGroupKey", "durationMin");
CREATE INDEX "MassageService_provenance_provenanceRunId_idx"
ON "MassageService"("provenance", "provenanceRunId");
CREATE INDEX "MassageService_lastMutationKey_idx"
ON "MassageService"("lastMutationKey");

CREATE TABLE "ServiceCatalogDraft" (
  "id" TEXT NOT NULL,
  "serviceGroupKey" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "payload" JSONB NOT NULL,
  "lastMutationKey" TEXT,
  "lastMutationHash" TEXT,
  "createdById" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ServiceCatalogDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCatalogDraft_serviceGroupKey_key"
ON "ServiceCatalogDraft"("serviceGroupKey");
CREATE UNIQUE INDEX "ServiceCatalogDraft_lastMutationKey_key"
ON "ServiceCatalogDraft"("lastMutationKey");
CREATE INDEX "ServiceCatalogDraft_updatedAt_idx"
ON "ServiceCatalogDraft"("updatedAt");

ALTER TABLE "BookingService"
ADD COLUMN "payoutRuleIdSnapshot" TEXT,
ADD COLUMN "providerPayoutAmountSnapshot" INTEGER,
ADD COLUMN "payoutRuleSnapshot" JSONB;

-- Preserve the exact payout rule used by existing booked service prices when that evidence exists.
-- Rows without an exact historical rule remain NULL and require explicit operational review.
UPDATE "BookingService" booked
SET
  "payoutRuleIdSnapshot" = payout."id",
  "providerPayoutAmountSnapshot" = payout."providerPayoutAmount",
  "payoutRuleSnapshot" = jsonb_build_object(
    'id', payout."id",
    'customerPrice', payout."customerPrice",
    'providerPayoutAmount', payout."providerPayoutAmount",
    'vatBps', payout."vatBps",
    'otherCostAmount', payout."otherCostAmount",
    'currency', payout."currency"
  )
FROM "ServicePayoutRule" payout
WHERE payout."serviceId" = booked."serviceId"
  AND payout."customerPrice" = booked."price"
  AND booked."payoutRuleIdSnapshot" IS NULL;

-- Payout rules are immutable versions. A new publication creates a new row and
-- deactivates the previous current row instead of overwriting financial evidence.
DROP INDEX "ServicePayoutRule_serviceId_customerPrice_key";
CREATE INDEX "ServicePayoutRule_serviceId_customerPrice_createdAt_idx"
ON "ServicePayoutRule"("serviceId", "customerPrice", "createdAt");

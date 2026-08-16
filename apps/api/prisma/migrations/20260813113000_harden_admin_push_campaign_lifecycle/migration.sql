CREATE TYPE "AdminPushCampaignStatus" AS ENUM (
  'PREVIEWED',
  'QUEUED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED',
  'EXPIRED'
);

CREATE TYPE "AdminPushCampaignRecipientStatus" AS ENUM (
  'SNAPSHOTTED',
  'PROCESSING',
  'COMPLETED',
  'PARTIAL_FAILED',
  'FAILED',
  'SKIPPED'
);

ALTER TABLE "AdminPushCampaign"
  ADD COLUMN "targetSegment" TEXT NOT NULL DEFAULT 'all',
  ADD COLUMN "appDestination" TEXT NOT NULL DEFAULT 'notificationCenter',
  ADD COLUMN "operatorReason" TEXT,
  ADD COLUMN "copyHash" TEXT,
  ADD COLUMN "criteriaHash" TEXT,
  ADD COLUMN "recipientFingerprint" TEXT,
  ADD COLUMN "expiresAt" TIMESTAMP(3),
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "eligibleDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "excludedUserCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "excludedDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveredDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "pendingDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skippedDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "queuedAt" TIMESTAMP(3),
  ADD COLUMN "processingAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "failedAt" TIMESTAMP(3),
  ADD COLUMN "queueJobId" TEXT;

ALTER TABLE "AdminPushCampaign"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AdminPushCampaignStatus"
    USING CASE
      WHEN "status" = 'SENT' THEN 'COMPLETED'::"AdminPushCampaignStatus"
      WHEN "status" IN ('PREVIEWED', 'QUEUED', 'PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'EXPIRED')
        THEN "status"::"AdminPushCampaignStatus"
      ELSE 'FAILED'::"AdminPushCampaignStatus"
    END,
  ALTER COLUMN "status" SET DEFAULT 'PREVIEWED';

ALTER TABLE "AdminPushCampaignRecipient"
  ADD COLUMN "deviceIds" JSONB,
  ADD COLUMN "eligibleDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "deliveredDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failedDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "skippedDeviceCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "lastErrorCode" TEXT,
  ADD COLUMN "processedAt" TIMESTAMP(3);

ALTER TABLE "AdminPushCampaignRecipient"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "AdminPushCampaignRecipientStatus"
    USING CASE
      WHEN "status" IN ('QUEUED', 'SNAPSHOTTED') THEN 'SNAPSHOTTED'::"AdminPushCampaignRecipientStatus"
      WHEN "status" IN ('PROCESSING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED', 'SKIPPED')
        THEN "status"::"AdminPushCampaignRecipientStatus"
      ELSE 'FAILED'::"AdminPushCampaignRecipientStatus"
    END,
  ALTER COLUMN "status" SET DEFAULT 'SNAPSHOTTED';

CREATE UNIQUE INDEX "AdminPushCampaign_idempotencyKey_key"
  ON "AdminPushCampaign"("idempotencyKey");
CREATE INDEX "AdminPushCampaign_status_createdAt_idx"
  ON "AdminPushCampaign"("status", "createdAt");

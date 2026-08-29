ALTER TYPE "AdminOperatorPermissionCategory" ADD VALUE IF NOT EXISTS 'NOTIFICATIONS_INCIDENTS';

CREATE TYPE "NotificationDeliveryIncidentState" AS ENUM ('OPEN', 'INVESTIGATING', 'RESOLVED');

CREATE TYPE "NotificationDeliveryIncidentResolutionCode" AS ENUM (
  'PROVIDER_RECOVERED',
  'DEVICE_ROUTE_REFRESHED',
  'CONFIGURATION_FIXED',
  'RETRY_SUCCEEDED',
  'FALSE_POSITIVE',
  'CUSTOMER_CONTACTED',
  'OTHER'
);

CREATE TABLE "NotificationDeliveryIncident" (
  "id" TEXT NOT NULL,
  "sourceKind" TEXT NOT NULL DEFAULT 'DELIVERY_FAILURE',
  "sourceKey" TEXT NOT NULL,
  "occurrence" INTEGER NOT NULL DEFAULT 1,
  "dataScope" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "failureCode" TEXT NOT NULL,
  "state" "NotificationDeliveryIncidentState" NOT NULL DEFAULT 'OPEN',
  "ownerAdminId" TEXT,
  "resolutionCode" "NotificationDeliveryIncidentResolutionCode",
  "resolutionNote" TEXT,
  "firstObservedAt" TIMESTAMP(3) NOT NULL,
  "lastObservedAt" TIMESTAMP(3) NOT NULL,
  "lastVerifiedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "resolvedByAdminId" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "NotificationDeliveryIncident_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NotificationDeliveryIncident_sourceKind_check"
    CHECK ("sourceKind" = 'DELIVERY_FAILURE'),
  CONSTRAINT "NotificationDeliveryIncident_sourceKey_check"
    CHECK (char_length(btrim("sourceKey")) BETWEEN 1 AND 500),
  CONSTRAINT "NotificationDeliveryIncident_dataScope_check"
    CHECK ("dataScope" IN ('production', 'synthetic', 'unknown')),
  CONSTRAINT "NotificationDeliveryIncident_provider_check"
    CHECK (char_length(btrim("provider")) BETWEEN 1 AND 80),
  CONSTRAINT "NotificationDeliveryIncident_failureCode_check"
    CHECK (char_length(btrim("failureCode")) BETWEEN 1 AND 160),
  CONSTRAINT "NotificationDeliveryIncident_occurrence_check"
    CHECK ("occurrence" > 0),
  CONSTRAINT "NotificationDeliveryIncident_revision_check"
    CHECK ("revision" > 0),
  CONSTRAINT "NotificationDeliveryIncident_observed_window_check"
    CHECK ("lastObservedAt" >= "firstObservedAt"),
  CONSTRAINT "NotificationDeliveryIncident_resolution_check"
    CHECK (
      (
        "state" <> 'RESOLVED'
        AND "resolutionCode" IS NULL
        AND "resolutionNote" IS NULL
        AND "resolvedAt" IS NULL
        AND "resolvedByAdminId" IS NULL
      )
      OR (
        "state" = 'RESOLVED'
        AND "resolutionCode" IS NOT NULL
        AND "resolutionNote" IS NOT NULL
        AND char_length(btrim("resolutionNote")) BETWEEN 12 AND 500
        AND "resolvedAt" IS NOT NULL
        AND "resolvedByAdminId" IS NOT NULL
      )
    )
);

CREATE TABLE "NotificationDeliveryIncidentMember" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "notificationId" TEXT NOT NULL,
  "deliveryId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "NotificationDeliveryIncidentMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NotificationDeliveryIncident_sourceKey_occurrence_key"
  ON "NotificationDeliveryIncident"("sourceKey", "occurrence");
CREATE INDEX "NotificationDeliveryIncident_state_lastObservedAt_idx"
  ON "NotificationDeliveryIncident"("state", "lastObservedAt");
CREATE INDEX "NotificationDeliveryIncident_ownerAdminId_state_lastObservedAt_idx"
  ON "NotificationDeliveryIncident"("ownerAdminId", "state", "lastObservedAt");
CREATE INDEX "NotificationDeliveryIncident_dataScope_state_lastObservedAt_idx"
  ON "NotificationDeliveryIncident"("dataScope", "state", "lastObservedAt");
CREATE INDEX "NotificationDeliveryIncident_provider_failureCode_state_idx"
  ON "NotificationDeliveryIncident"("provider", "failureCode", "state");
CREATE UNIQUE INDEX "NotificationDeliveryIncidentMember_incidentId_deliveryId_key"
  ON "NotificationDeliveryIncidentMember"("incidentId", "deliveryId");
CREATE INDEX "NotificationDeliveryIncidentMember_notificationId_observedAt_idx"
  ON "NotificationDeliveryIncidentMember"("notificationId", "observedAt");
CREATE INDEX "NotificationDeliveryIncidentMember_deliveryId_idx"
  ON "NotificationDeliveryIncidentMember"("deliveryId");

ALTER TABLE "NotificationDeliveryIncident"
  ADD CONSTRAINT "NotificationDeliveryIncident_ownerAdminId_fkey"
  FOREIGN KEY ("ownerAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryIncident"
  ADD CONSTRAINT "NotificationDeliveryIncident_resolvedByAdminId_fkey"
  FOREIGN KEY ("resolvedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryIncidentMember"
  ADD CONSTRAINT "NotificationDeliveryIncidentMember_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "NotificationDeliveryIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryIncidentMember"
  ADD CONSTRAINT "NotificationDeliveryIncidentMember_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NotificationDeliveryIncidentMember"
  ADD CONSTRAINT "NotificationDeliveryIncidentMember_deliveryId_fkey"
  FOREIGN KEY ("deliveryId") REFERENCES "NotificationDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

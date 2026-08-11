CREATE TYPE "ProviderAvailabilityIntent" AS ENUM ('OFFLINE', 'AVAILABLE');

CREATE TYPE "ProviderAvailabilityReason" AS ENUM (
  'SYSTEM_DEFAULT',
  'MANUAL_AVAILABLE',
  'MANUAL_OFFLINE',
  'OUTSIDE_WORKING_HOURS',
  'ACTIVE_BOOKING',
  'INACTIVE_7D'
);

ALTER TABLE "ProviderProfile"
  ADD COLUMN "availabilityIntent" "ProviderAvailabilityIntent" NOT NULL DEFAULT 'OFFLINE',
  ADD COLUMN "availabilityReason" "ProviderAvailabilityReason" NOT NULL DEFAULT 'SYSTEM_DEFAULT',
  ADD COLUMN "availabilityChangedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "workingHoursTimezone" TEXT NOT NULL DEFAULT 'Asia/Ho_Chi_Minh';

UPDATE "ProviderProfile"
SET
  "availabilityIntent" = CASE
    WHEN "status" = 'OFFLINE' THEN 'OFFLINE'::"ProviderAvailabilityIntent"
    ELSE 'AVAILABLE'::"ProviderAvailabilityIntent"
  END,
  "availabilityReason" = CASE
    WHEN "status" = 'OFFLINE' THEN 'SYSTEM_DEFAULT'::"ProviderAvailabilityReason"
    ELSE 'MANUAL_AVAILABLE'::"ProviderAvailabilityReason"
  END,
  "availabilityChangedAt" = "updatedAt";

CREATE TABLE "ProviderWorkingHour" (
  "id" TEXT NOT NULL,
  "providerProfileId" TEXT NOT NULL,
  "weekday" INTEGER NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "startMinute" INTEGER NOT NULL,
  "endMinute" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ProviderWorkingHour_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProviderWorkingHour_weekday_check" CHECK ("weekday" BETWEEN 1 AND 7),
  CONSTRAINT "ProviderWorkingHour_start_minute_check" CHECK ("startMinute" BETWEEN 0 AND 1439),
  CONSTRAINT "ProviderWorkingHour_end_minute_check" CHECK ("endMinute" BETWEEN 1 AND 1440),
  CONSTRAINT "ProviderWorkingHour_time_order_check" CHECK ("startMinute" < "endMinute")
);

CREATE UNIQUE INDEX "ProviderWorkingHour_providerProfileId_weekday_key"
  ON "ProviderWorkingHour"("providerProfileId", "weekday");

CREATE INDEX "ProviderWorkingHour_providerProfileId_enabled_weekday_idx"
  ON "ProviderWorkingHour"("providerProfileId", "enabled", "weekday");

CREATE INDEX "ProviderProfile_availabilityIntent_status_idx"
  ON "ProviderProfile"("availabilityIntent", "status");

ALTER TABLE "ProviderWorkingHour"
  ADD CONSTRAINT "ProviderWorkingHour_providerProfileId_fkey"
  FOREIGN KEY ("providerProfileId") REFERENCES "ProviderProfile"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

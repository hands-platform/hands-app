ALTER TABLE "CustomerProfile"
ADD COLUMN "nationality" TEXT;

ALTER TABLE "ProviderProfile"
ADD COLUMN "bookingAlertPreferences" JSONB;

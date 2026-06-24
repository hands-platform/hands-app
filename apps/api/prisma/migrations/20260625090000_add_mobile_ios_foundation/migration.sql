-- AlterTable
ALTER TABLE "PushDevice"
ADD COLUMN "pushProvider" TEXT NOT NULL DEFAULT 'FCM',
ADD COLUMN "appVersion" TEXT,
ADD COLUMN "osVersion" TEXT,
ADD COLUMN "deviceModel" TEXT,
ADD COLUMN "locale" TEXT,
ADD COLUMN "timezone" TEXT;

-- CreateTable
CREATE TABLE "AppVersionPolicy" (
    "id" TEXT NOT NULL,
    "appType" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "minimumSupportedVersion" TEXT,
    "latestVersion" TEXT,
    "forceUpdate" BOOLEAN NOT NULL DEFAULT false,
    "updateUrl" TEXT,
    "releaseNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppVersionPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppVersionPolicy_appType_platform_key" ON "AppVersionPolicy"("appType", "platform");

-- CreateIndex
CREATE INDEX "AppVersionPolicy_appType_platform_isActive_idx" ON "AppVersionPolicy"("appType", "platform", "isActive");

-- CreateIndex
CREATE INDEX "PushDevice_platform_pushProvider_enabled_idx" ON "PushDevice"("platform", "pushProvider", "enabled");

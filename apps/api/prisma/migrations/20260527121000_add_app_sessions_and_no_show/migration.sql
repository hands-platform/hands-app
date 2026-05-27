ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'NO_SHOW';

CREATE TABLE "AppSession" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "deviceId" TEXT NOT NULL,
  "platform" TEXT,
  "appVersion" TEXT,
  "ipAddress" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AppSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppSession_userId_role_deviceId_key" ON "AppSession"("userId", "role", "deviceId");
CREATE INDEX "AppSession_role_active_lastSeenAt_idx" ON "AppSession"("role", "active", "lastSeenAt");
CREATE INDEX "AppSession_userId_lastSeenAt_idx" ON "AppSession"("userId", "lastSeenAt");

ALTER TABLE "AppSession"
  ADD CONSTRAINT "AppSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

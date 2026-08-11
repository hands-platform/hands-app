CREATE TYPE "AppUsageEventType" AS ENUM (
  'APP_OPEN',
  'SESSION_START',
  'PROVIDER_PROFILE_VIEW'
);

CREATE TABLE "AppUsageEvent" (
  "id" TEXT NOT NULL,
  "clientEventId" TEXT,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "eventType" "AppUsageEventType" NOT NULL,
  "deviceId" TEXT,
  "subjectType" TEXT,
  "subjectId" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppUsageEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUsageEvent_clientEventId_key"
ON "AppUsageEvent"("clientEventId");

CREATE INDEX "AppUsageEvent_eventType_occurredAt_idx"
ON "AppUsageEvent"("eventType", "occurredAt");

CREATE INDEX "AppUsageEvent_userId_eventType_occurredAt_idx"
ON "AppUsageEvent"("userId", "eventType", "occurredAt");

CREATE INDEX "AppUsageEvent_role_eventType_occurredAt_idx"
ON "AppUsageEvent"("role", "eventType", "occurredAt");

CREATE INDEX "AppUsageEvent_subjectType_subjectId_occurredAt_idx"
ON "AppUsageEvent"("subjectType", "subjectId", "occurredAt");

ALTER TABLE "AppUsageEvent"
ADD CONSTRAINT "AppUsageEvent_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

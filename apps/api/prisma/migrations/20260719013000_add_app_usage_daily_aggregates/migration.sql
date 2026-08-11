CREATE TABLE "AppUsageDailyAggregate" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "day" DATE NOT NULL,
  "totalEventCount" INTEGER NOT NULL DEFAULT 0,
  "appOpenCount" INTEGER NOT NULL DEFAULT 0,
  "sessionStartCount" INTEGER NOT NULL DEFAULT 0,
  "providerProfileViewCount" INTEGER NOT NULL DEFAULT 0,
  "firstOccurredAt" TIMESTAMP(3) NOT NULL,
  "lastOccurredAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AppUsageDailyAggregate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AppUsageDailyAggregate_userId_role_day_key"
ON "AppUsageDailyAggregate"("userId", "role", "day");

CREATE INDEX "AppUsageDailyAggregate_role_day_idx"
ON "AppUsageDailyAggregate"("role", "day");

CREATE INDEX "AppUsageDailyAggregate_day_lastOccurredAt_idx"
ON "AppUsageDailyAggregate"("day", "lastOccurredAt");

ALTER TABLE "AppUsageDailyAggregate"
ADD CONSTRAINT "AppUsageDailyAggregate_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "AppUsageDailyAggregate" (
  "id",
  "userId",
  "role",
  "day",
  "totalEventCount",
  "appOpenCount",
  "sessionStartCount",
  "providerProfileViewCount",
  "firstOccurredAt",
  "lastOccurredAt"
)
SELECT
  'usage-day-' || MD5(
    usage_event."userId" || ':' || usage_event."role"::text || ':' ||
    (usage_event."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
  ),
  usage_event."userId",
  usage_event."role",
  (usage_event."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
  COUNT(*)::integer,
  COUNT(*) FILTER (WHERE usage_event."eventType" = 'APP_OPEN')::integer,
  COUNT(*) FILTER (WHERE usage_event."eventType" = 'SESSION_START')::integer,
  COUNT(*) FILTER (WHERE usage_event."eventType" = 'PROVIDER_PROFILE_VIEW')::integer,
  MIN(usage_event."occurredAt"),
  MAX(usage_event."occurredAt")
FROM "AppUsageEvent" usage_event
GROUP BY
  usage_event."userId",
  usage_event."role",
  (usage_event."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;

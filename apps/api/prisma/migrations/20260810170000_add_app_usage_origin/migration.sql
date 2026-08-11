CREATE TYPE "AppUsageOrigin" AS ENUM ('PRODUCTION', 'SYNTHETIC', 'UNKNOWN');

ALTER TABLE "AppUsageEvent"
ADD COLUMN "origin" "AppUsageOrigin" NOT NULL DEFAULT 'UNKNOWN';

UPDATE "AppUsageEvent"
SET "origin" = 'SYNTHETIC'
WHERE UPPER(COALESCE("metadata" #>> '{dataOrigin}', '')) = 'SYNTHETIC';

ALTER TABLE "AppUsageDailyAggregate"
ADD COLUMN "origin" "AppUsageOrigin" NOT NULL DEFAULT 'UNKNOWN';

DROP INDEX "AppUsageDailyAggregate_userId_role_day_key";
DROP INDEX "AppUsageDailyAggregate_role_day_idx";

CREATE UNIQUE INDEX "AppUsageDailyAggregate_userId_role_day_origin_key"
ON "AppUsageDailyAggregate"("userId", "role", "day", "origin");

CREATE INDEX "AppUsageDailyAggregate_role_origin_day_idx"
ON "AppUsageDailyAggregate"("role", "origin", "day");

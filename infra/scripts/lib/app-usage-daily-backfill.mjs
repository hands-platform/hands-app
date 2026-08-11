import { Prisma } from '@prisma/client';

export const APP_USAGE_BACKFILL_TIME_ZONE = 'Asia/Ho_Chi_Minh';
export const DEFAULT_APP_USAGE_BACKFILL_DAYS = 90;
export const MAX_APP_USAGE_BACKFILL_DAYS = 90;

const DAY_MS = 24 * 60 * 60 * 1_000;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1_000;

export function resolveAppUsageBackfillWindow({
  days = DEFAULT_APP_USAGE_BACKFILL_DAYS,
  from,
  includeCurrentDay = false,
  now = new Date(),
  to,
} = {}) {
  assertCondition(Number.isInteger(days) && days >= 1 && days <= MAX_APP_USAGE_BACKFILL_DAYS,
    `Backfill days must be between 1 and ${MAX_APP_USAGE_BACKFILL_DAYS}.`);
  assertCondition(Boolean(from) === Boolean(to), '--from and --to must be provided together.');

  const currentVietnamDay = vietnamDateKey(now);
  const toDay = to ? parseVietnamDateKey(to, '--to') : shiftVietnamDateKey(currentVietnamDay, -1);
  const fromDay = from ? parseVietnamDateKey(from, '--from') : shiftVietnamDateKey(toDay, -(days - 1));
  const dayCount = dateKeyDistance(fromDay, toDay) + 1;

  assertCondition(dayCount >= 1, '--from must be on or before --to.');
  assertCondition(
    dayCount <= MAX_APP_USAGE_BACKFILL_DAYS,
    `Backfill range must not exceed ${MAX_APP_USAGE_BACKFILL_DAYS} Vietnam calendar days.`,
  );
  assertCondition(
    includeCurrentDay || toDay < currentVietnamDay,
    'The current Vietnam day is still receiving events. Pass --include-current-day only for a controlled repair.',
  );
  assertCondition(toDay <= currentVietnamDay, '--to must not be after the current Vietnam day.');

  return {
    dayCount,
    fromDay,
    fromDayValue: aggregateDate(fromDay),
    fromUtc: vietnamDayStartUtc(fromDay),
    includeCurrentDay,
    timeZone: APP_USAGE_BACKFILL_TIME_ZONE,
    toDay,
    toDayExclusiveValue: aggregateDate(shiftVietnamDateKey(toDay, 1)),
    toUtcExclusive: vietnamDayStartUtc(shiftVietnamDateKey(toDay, 1)),
  };
}

export function vietnamDateKey(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: APP_USAGE_BACKFILL_TIME_ZONE,
    year: 'numeric',
  }).formatToParts(value);
  const part = (type) => parts.find((candidate) => candidate.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function buildAppUsageDailyAggregateBackfillSql(window = null) {
  const sourceRows = appUsageSourceRowsSql(window);
  return Prisma.sql`
    INSERT INTO "AppUsageDailyAggregate" (
      "id", "userId", "role", "origin", "day", "totalEventCount", "appOpenCount",
      "sessionStartCount", "providerProfileViewCount", "firstOccurredAt", "lastOccurredAt"
    )
    ${sourceRows}
    ON CONFLICT ("userId", "role", "day", "origin") DO UPDATE SET
      "totalEventCount" = EXCLUDED."totalEventCount",
      "appOpenCount" = EXCLUDED."appOpenCount",
      "sessionStartCount" = EXCLUDED."sessionStartCount",
      "providerProfileViewCount" = EXCLUDED."providerProfileViewCount",
      "firstOccurredAt" = EXCLUDED."firstOccurredAt",
      "lastOccurredAt" = EXCLUDED."lastOccurredAt",
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE
      "AppUsageDailyAggregate"."totalEventCount" IS DISTINCT FROM EXCLUDED."totalEventCount" OR
      "AppUsageDailyAggregate"."appOpenCount" IS DISTINCT FROM EXCLUDED."appOpenCount" OR
      "AppUsageDailyAggregate"."sessionStartCount" IS DISTINCT FROM EXCLUDED."sessionStartCount" OR
      "AppUsageDailyAggregate"."providerProfileViewCount" IS DISTINCT FROM EXCLUDED."providerProfileViewCount" OR
      "AppUsageDailyAggregate"."firstOccurredAt" IS DISTINCT FROM EXCLUDED."firstOccurredAt" OR
      "AppUsageDailyAggregate"."lastOccurredAt" IS DISTINCT FROM EXCLUDED."lastOccurredAt"
  `;
}

export async function executeAppUsageDailyAggregateBackfill(transaction, window = null) {
  return transaction.$executeRaw(buildAppUsageDailyAggregateBackfillSql(window));
}

export async function inspectAppUsageDailyAggregateBackfill(prisma, window) {
  const sourceRows = appUsageSourceRowsSql(window);
  const rows = await prisma.$queryRaw(Prisma.sql`
    WITH source_rows AS (${sourceRows})
    SELECT
      COUNT(*)::bigint AS "sourceRows",
      COALESCE(SUM(source."totalEventCount"), 0)::bigint AS "sourceEvents",
      COUNT(*) FILTER (WHERE target."id" IS NULL)::bigint AS "missingRows",
      COALESCE(SUM(source."totalEventCount") FILTER (WHERE source."origin"::text = 'PRODUCTION'), 0)::bigint AS "productionEvents",
      COALESCE(SUM(source."totalEventCount") FILTER (WHERE source."origin"::text = 'SYNTHETIC'), 0)::bigint AS "syntheticEvents",
      COALESCE(SUM(source."totalEventCount") FILTER (WHERE source."origin"::text = 'UNKNOWN'), 0)::bigint AS "unknownEvents",
      COUNT(*) FILTER (
        WHERE target."id" IS NOT NULL AND (
          target."totalEventCount" IS DISTINCT FROM source."totalEventCount" OR
          target."appOpenCount" IS DISTINCT FROM source."appOpenCount" OR
          target."sessionStartCount" IS DISTINCT FROM source."sessionStartCount" OR
          target."providerProfileViewCount" IS DISTINCT FROM source."providerProfileViewCount" OR
          target."firstOccurredAt" IS DISTINCT FROM source."firstOccurredAt" OR
          target."lastOccurredAt" IS DISTINCT FROM source."lastOccurredAt"
        )
      )::bigint AS "mismatchedRows",
      (
        SELECT COUNT(*)::bigint
        FROM "AppUsageDailyAggregate" aggregate_only
        LEFT JOIN source_rows matching_source
          ON matching_source."userId" = aggregate_only."userId"
          AND matching_source."role" = aggregate_only."role"
          AND matching_source."day" = aggregate_only."day"
          AND matching_source."origin" = aggregate_only."origin"
        WHERE aggregate_only."day" >= ${window.fromDayValue}
          AND aggregate_only."day" < ${window.toDayExclusiveValue}
          AND matching_source."userId" IS NULL
      ) AS "aggregateOnlyRows"
    FROM source_rows source
    LEFT JOIN "AppUsageDailyAggregate" target
      ON target."userId" = source."userId"
      AND target."role" = source."role"
      AND target."day" = source."day"
      AND target."origin" = source."origin"
  `);
  const row = rows[0] ?? {};
  return {
    aggregateOnlyRows: integer(row.aggregateOnlyRows),
    mismatchedRows: integer(row.mismatchedRows),
    missingRows: integer(row.missingRows),
    productionEvents: integer(row.productionEvents),
    sourceEvents: integer(row.sourceEvents),
    sourceRows: integer(row.sourceRows),
    syntheticEvents: integer(row.syntheticEvents),
    unknownEvents: integer(row.unknownEvents),
  };
}

function appUsageSourceRowsSql(window) {
  const where = window
    ? Prisma.sql`WHERE usage_event."occurredAt" >= ${window.fromUtc}
        AND usage_event."occurredAt" < ${window.toUtcExclusive}`
    : Prisma.sql``;
  return Prisma.sql`
    SELECT
      'usage-day-' || MD5(
        usage_event."userId" || ':' || usage_event."role"::text || ':' || usage_event."origin"::text || ':' ||
        (usage_event."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date::text
      ) AS "id",
      usage_event."userId" AS "userId",
      usage_event."role" AS "role",
      usage_event."origin" AS "origin",
      (usage_event."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS "day",
      COUNT(*)::integer AS "totalEventCount",
      COUNT(*) FILTER (WHERE usage_event."eventType"::text = 'APP_OPEN')::integer AS "appOpenCount",
      COUNT(*) FILTER (WHERE usage_event."eventType"::text = 'SESSION_START')::integer AS "sessionStartCount",
      COUNT(*) FILTER (WHERE usage_event."eventType"::text = 'PROVIDER_PROFILE_VIEW')::integer AS "providerProfileViewCount",
      MIN(usage_event."occurredAt") AS "firstOccurredAt",
      MAX(usage_event."occurredAt") AS "lastOccurredAt"
    FROM "AppUsageEvent" usage_event
    ${where}
    GROUP BY
      usage_event."userId",
      usage_event."role",
      usage_event."origin",
      (usage_event."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
  `;
}

function parseVietnamDateKey(value, name) {
  assertCondition(/^\d{4}-\d{2}-\d{2}$/.test(value), `${name} must use YYYY-MM-DD.`);
  const parsed = aggregateDate(value);
  assertCondition(parsed.toISOString().slice(0, 10) === value, `${name} is not a valid calendar date.`);
  return value;
}

function shiftVietnamDateKey(value, days) {
  return new Date(aggregateDate(value).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function dateKeyDistance(from, to) {
  return Math.floor((aggregateDate(to).getTime() - aggregateDate(from).getTime()) / DAY_MS);
}

function aggregateDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function vietnamDayStartUtc(value) {
  return new Date(aggregateDate(value).getTime() - VIETNAM_OFFSET_MS);
}

function integer(value) {
  const number = typeof value === 'bigint' ? Number(value) : Number(value ?? 0);
  assertCondition(Number.isSafeInteger(number) && number >= 0, 'Backfill count exceeds the safe integer range.');
  return number;
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

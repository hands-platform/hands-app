import { PrismaClient } from '@prisma/client';

import { executeAppUsageDailyAggregateBackfill } from './lib/app-usage-daily-backfill.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const { env } = loadMergedEnv('.env');
const apply = process.argv.includes('--apply');
const rawRetentionDays = retentionDays(env.APP_USAGE_RAW_RETENTION_DAYS, 90, 'APP_USAGE_RAW_RETENTION_DAYS');
const dailyRetentionDays = retentionDays(
  env.APP_USAGE_DAILY_RETENTION_DAYS,
  0,
  'APP_USAGE_DAILY_RETENTION_DAYS',
);
const databaseUrl = env.DATABASE_URL?.trim();

assert(databaseUrl, 'DATABASE_URL is required.');
assert(
  dailyRetentionDays === 0 || dailyRetentionDays >= rawRetentionDays,
  'Daily aggregates must be retained at least as long as raw events.',
);
if (apply && env.NODE_ENV === 'production') {
  assert(
    env.APP_USAGE_RETENTION_CONFIRM === 'DELETE_OLD_APP_USAGE',
    'Production retention requires APP_USAGE_RETENTION_CONFIRM=DELETE_OLD_APP_USAGE.',
  );
}

process.env.DATABASE_URL ??= databaseUrl;
const prisma = new PrismaClient();
const now = new Date();
const rawCutoff = vietnamDayStartUtc(now, rawRetentionDays);
const dailyCutoff = dailyRetentionDays ? vietnamAggregateDay(now, dailyRetentionDays) : null;

try {
  const [rawCandidates, dailyCandidates] = await Promise.all([
    prisma.appUsageEvent.count({ where: { occurredAt: { lt: rawCutoff } } }),
    dailyCutoff
      ? prisma.appUsageDailyAggregate.count({ where: { day: { lt: dailyCutoff } } })
      : Promise.resolve(0),
  ]);

  let rawDeleted = 0;
  let dailyDeleted = 0;
  if (apply) {
    await prisma.$transaction(async (transaction) => {
      await executeAppUsageDailyAggregateBackfill(transaction);
      rawDeleted = (
        await transaction.appUsageEvent.deleteMany({ where: { occurredAt: { lt: rawCutoff } } })
      ).count;
      if (dailyCutoff) {
        dailyDeleted = (
          await transaction.appUsageDailyAggregate.deleteMany({ where: { day: { lt: dailyCutoff } } })
        ).count;
      }
    });
  }

  console.log(
    JSON.stringify(
      {
        apply,
        daily: {
          candidates: dailyCandidates,
          cutoff: dailyCutoff?.toISOString() ?? null,
          deleted: dailyDeleted,
          retentionDays: dailyRetentionDays || 'indefinite',
        },
        raw: {
          candidates: rawCandidates,
          cutoff: rawCutoff.toISOString(),
          deleted: rawDeleted,
          retentionDays: rawRetentionDays,
        },
      },
      null,
      2,
    ),
  );
} finally {
  await prisma.$disconnect();
}

function retentionDays(value, fallback, name) {
  const parsed = value?.trim() ? Number(value) : fallback;
  assert(Number.isInteger(parsed) && parsed >= 0, `${name} must be a non-negative integer.`);
  if (name === 'APP_USAGE_RAW_RETENTION_DAYS') {
    assert(parsed >= 30 && parsed <= 365, `${name} must be between 30 and 365 days.`);
  }
  return parsed;
}

function vietnamDayParts(value) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
  }).formatToParts(value);
  const part = (type) => Number(parts.find((candidate) => candidate.type === type)?.value);
  return { day: part('day'), month: part('month'), year: part('year') };
}

function vietnamAggregateDay(value, daysAgo) {
  const { day, month, year } = vietnamDayParts(value);
  return new Date(Date.UTC(year, month - 1, day - daysAgo));
}

function vietnamDayStartUtc(value, daysAgo) {
  return new Date(vietnamAggregateDay(value, daysAgo).getTime() - 7 * 60 * 60 * 1_000);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

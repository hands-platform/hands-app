import { randomUUID } from 'node:crypto';

import { AppUsageEventType, AppUsageOrigin, PrismaClient, Role } from '@prisma/client';

import {
  executeAppUsageDailyAggregateBackfill,
  inspectAppUsageDailyAggregateBackfill,
  resolveAppUsageBackfillWindow,
} from './lib/app-usage-daily-backfill.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const { env } = loadMergedEnv('.env');
const databaseUrl = env.DATABASE_URL?.trim();
assertCondition(databaseUrl, 'DATABASE_URL is required for App usage backfill smoke.');
assertLocalDatabase(databaseUrl, env.NODE_ENV);

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
const runId = `app-usage-backfill-smoke-${randomUUID()}`;
let userId = null;

try {
  const window = resolveAppUsageBackfillWindow({ days: 1 });
  const user = await prisma.user.create({
    data: {
      fullName: 'App usage backfill smoke',
      phone: `smoke-${randomUUID()}@usage.local`,
      roles: [Role.CUSTOMER],
    },
    select: { id: true },
  });
  userId = user.id;
  const occurredAt = [
    new Date(window.fromUtc.getTime() + 60 * 60 * 1_000),
    new Date(window.fromUtc.getTime() + 2 * 60 * 60 * 1_000),
    new Date(window.fromUtc.getTime() + 3 * 60 * 60 * 1_000),
    new Date(window.fromUtc.getTime() + 4 * 60 * 60 * 1_000),
  ];
  await prisma.appUsageEvent.createMany({
    data: [
      event(runId, user.id, AppUsageEventType.APP_OPEN, occurredAt[0], 1),
      event(runId, user.id, AppUsageEventType.APP_OPEN, occurredAt[1], 2),
      event(runId, user.id, AppUsageEventType.SESSION_START, occurredAt[2], 3),
      event(runId, user.id, AppUsageEventType.PROVIDER_PROFILE_VIEW, occurredAt[3], 4),
    ],
  });

  const before = await inspectAppUsageDailyAggregateBackfill(prisma, window);
  assertCondition(before.missingRows === 1, 'Smoke source row was not reported as missing.');

  const firstApplyRows = await prisma.$transaction((transaction) =>
    executeAppUsageDailyAggregateBackfill(transaction, window),
  );
  const after = await inspectAppUsageDailyAggregateBackfill(prisma, window);
  assertCondition(after.missingRows === 0 && after.mismatchedRows === 0, 'Backfill verification failed.');

  const aggregate = await prisma.appUsageDailyAggregate.findUniqueOrThrow({
    where: {
      userId_role_day_origin: {
        day: window.fromDayValue,
        origin: AppUsageOrigin.SYNTHETIC,
        role: Role.CUSTOMER,
        userId: user.id,
      },
    },
  });
  assertCondition(aggregate.totalEventCount === 4, 'Total event count is incorrect.');
  assertCondition(aggregate.appOpenCount === 2, 'APP_OPEN count is incorrect.');
  assertCondition(aggregate.sessionStartCount === 1, 'SESSION_START count is incorrect.');
  assertCondition(aggregate.providerProfileViewCount === 1, 'PROVIDER_PROFILE_VIEW count is incorrect.');
  assertCondition(
    aggregate.firstOccurredAt.getTime() === occurredAt[0].getTime() &&
      aggregate.lastOccurredAt.getTime() === occurredAt[3].getTime(),
    'Aggregate occurrence bounds are incorrect.',
  );

  const secondApplyRows = await prisma.$transaction((transaction) =>
    executeAppUsageDailyAggregateBackfill(transaction, window),
  );
  assertCondition(secondApplyRows === 0, 'A consistent second backfill must be a no-op.');

  console.log(JSON.stringify({
    ok: true,
    runId,
    window: { from: window.fromDay, to: window.toDay, timeZone: window.timeZone },
    before,
    firstApplyRows,
    verification: after,
    secondApplyRows,
    counters: {
      appOpen: aggregate.appOpenCount,
      providerProfileView: aggregate.providerProfileViewCount,
      sessionStart: aggregate.sessionStartCount,
      total: aggregate.totalEventCount,
    },
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
} finally {
  if (userId) {
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.$disconnect();
}

function event(prefix, userId, eventType, occurredAt, index) {
  return {
    clientEventId: `${prefix}-${index}`,
    eventType,
    origin: AppUsageOrigin.SYNTHETIC,
    occurredAt,
    role: Role.CUSTOMER,
    userId,
  };
}

function assertLocalDatabase(value, nodeEnv) {
  const database = new URL(value);
  assertCondition(
    ['127.0.0.1', 'localhost', '::1'].includes(database.hostname) && nodeEnv !== 'production',
    'App usage backfill smoke only runs against a local non-production database.',
  );
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

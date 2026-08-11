import { PrismaClient } from '@prisma/client';

import {
  DEFAULT_APP_USAGE_BACKFILL_DAYS,
  executeAppUsageDailyAggregateBackfill,
  inspectAppUsageDailyAggregateBackfill,
  resolveAppUsageBackfillWindow,
} from './lib/app-usage-daily-backfill.mjs';
import { loadMergedEnv } from './lib/env-file.mjs';

const apply = process.argv.includes('--apply');
const includeCurrentDay = process.argv.includes('--include-current-day');
const envFile = argumentValue('--env') ?? '.env';
const from = argumentValue('--from');
const to = argumentValue('--to');
const days = integerArgument('--days', DEFAULT_APP_USAGE_BACKFILL_DAYS);
const { env } = loadMergedEnv(envFile);
const databaseUrl = env.DATABASE_URL?.trim();

assertCondition(databaseUrl, 'DATABASE_URL is required for App usage daily backfill.');
assertApplyTarget(databaseUrl, apply, env);

const window = resolveAppUsageBackfillWindow({ days, from, includeCurrentDay, to });
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

try {
  const before = await inspectAppUsageDailyAggregateBackfill(prisma, window);
  let rebuiltRows = 0;
  let after = before;

  if (apply && (before.missingRows > 0 || before.mismatchedRows > 0)) {
    rebuiltRows = await prisma.$transaction((transaction) =>
      executeAppUsageDailyAggregateBackfill(transaction, window),
    );
    after = await inspectAppUsageDailyAggregateBackfill(prisma, window);
    assertCondition(after.missingRows === 0, 'Backfill verification found missing aggregate rows.');
    assertCondition(after.mismatchedRows === 0, 'Backfill verification found mismatched aggregate rows.');
  }

  console.log(JSON.stringify({
    ok: true,
    apply,
    dryRun: !apply,
    window: {
      dayCount: window.dayCount,
      from: window.fromDay,
      includeCurrentDay: window.includeCurrentDay,
      timeZone: window.timeZone,
      to: window.toDay,
    },
    before,
    applied: {
      rebuiltRows,
      skippedBecauseConsistent: apply && before.missingRows === 0 && before.mismatchedRows === 0,
    },
    verification: after,
    note: 'Aggregate-only rows are preserved because their raw evidence may already have expired.',
  }, null, 2));
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}

function argumentValue(name) {
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1)?.trim();
}

function integerArgument(name, fallback) {
  const value = argumentValue(name);
  if (!value) return fallback;
  const parsed = Number(value);
  assertCondition(Number.isInteger(parsed), `${name} must be an integer.`);
  return parsed;
}

function assertApplyTarget(value, isApply, environment) {
  if (!isApply) return;
  const database = new URL(value);
  const local = ['127.0.0.1', 'localhost', '::1'].includes(database.hostname);
  if (local && environment.NODE_ENV !== 'production') return;
  assertCondition(
    environment.APP_USAGE_BACKFILL_CONFIRM === 'REBUILD_APP_USAGE_DAILY',
    'Remote or production apply requires APP_USAGE_BACKFILL_CONFIRM=REBUILD_APP_USAGE_DAILY.',
  );
}

function assertCondition(condition, message) {
  if (!condition) throw new Error(message);
}

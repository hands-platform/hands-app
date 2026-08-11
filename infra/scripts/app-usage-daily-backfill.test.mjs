import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildAppUsageDailyAggregateBackfillSql,
  inspectAppUsageDailyAggregateBackfill,
  resolveAppUsageBackfillWindow,
  vietnamDateKey,
} from './lib/app-usage-daily-backfill.mjs';

test('uses complete Asia/Ho_Chi_Minh days by default', () => {
  const window = resolveAppUsageBackfillWindow({
    days: 7,
    now: new Date('2026-07-19T02:00:00.000Z'),
  });

  assert.equal(vietnamDateKey(new Date('2026-07-18T18:30:00.000Z')), '2026-07-19');
  assert.equal(window.fromDay, '2026-07-12');
  assert.equal(window.toDay, '2026-07-18');
  assert.equal(window.fromUtc.toISOString(), '2026-07-11T17:00:00.000Z');
  assert.equal(window.toUtcExclusive.toISOString(), '2026-07-18T17:00:00.000Z');
});

test('rejects an active Vietnam day unless explicitly controlled', () => {
  assert.throws(
    () => resolveAppUsageBackfillWindow({
      from: '2026-07-19',
      now: new Date('2026-07-19T02:00:00.000Z'),
      to: '2026-07-19',
    }),
    /current Vietnam day/,
  );
  const controlled = resolveAppUsageBackfillWindow({
    from: '2026-07-19',
    includeCurrentDay: true,
    now: new Date('2026-07-19T02:00:00.000Z'),
    to: '2026-07-19',
  });
  assert.equal(controlled.dayCount, 1);
});

test('rejects invalid and unbounded date ranges', () => {
  assert.throws(
    () => resolveAppUsageBackfillWindow({ from: '2026-02-30', to: '2026-03-01' }),
    /valid calendar date/,
  );
  assert.throws(
    () => resolveAppUsageBackfillWindow({
      from: '2025-01-01',
      includeCurrentDay: true,
      now: new Date('2026-07-19T02:00:00.000Z'),
      to: '2026-07-19',
    }),
    /must not exceed 90/,
  );
});

test('builds an absolute idempotent upsert instead of incrementing counters', () => {
  const window = resolveAppUsageBackfillWindow({
    from: '2026-07-01',
    now: new Date('2026-07-19T02:00:00.000Z'),
    to: '2026-07-18',
  });
  const sql = buildAppUsageDailyAggregateBackfillSql(window).strings.join(' ');

  assert.match(sql, /INSERT INTO "AppUsageDailyAggregate"/);
  assert.match(sql, /ON CONFLICT \("userId", "role", "day", "origin"\) DO UPDATE/);
  assert.match(sql, /"totalEventCount" = EXCLUDED\."totalEventCount"/);
  assert.doesNotMatch(sql, /increment/i);
  assert.match(sql, /usage_event\."occurredAt" >=/);
  assert.match(sql, /usage_event\."origin"/);
  assert.match(
    sql,
    /GROUP BY[\s\S]*usage_event\."userId",[\s\S]*usage_event\."role",[\s\S]*usage_event\."origin",/,
  );
  assert.match(sql, /Asia\/Ho_Chi_Minh/);
});

test('normalizes preview counts and keeps aggregate-only rows visible', async () => {
  const prisma = {
    $queryRaw: async () => [{
      aggregateOnlyRows: 3n,
      mismatchedRows: 2n,
      missingRows: 1n,
      productionEvents: 7n,
      sourceEvents: 12n,
      sourceRows: 4n,
      syntheticEvents: 3n,
      unknownEvents: 2n,
    }],
  };
  const window = resolveAppUsageBackfillWindow({
    from: '2026-07-01',
    now: new Date('2026-07-19T02:00:00.000Z'),
    to: '2026-07-18',
  });

  assert.deepEqual(await inspectAppUsageDailyAggregateBackfill(prisma, window), {
    aggregateOnlyRows: 3,
    mismatchedRows: 2,
    missingRows: 1,
    productionEvents: 7,
    sourceEvents: 12,
    sourceRows: 4,
    syntheticEvents: 3,
    unknownEvents: 2,
  });
});

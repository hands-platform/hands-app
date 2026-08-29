import assert from 'node:assert/strict';
import test from 'node:test';

import {
  notificationIncidentPerformanceDecision,
  notificationIncidentPerformanceTarget,
  parseNotificationIncidentPerformanceArgs,
  summarizeNotificationIncidentPlan,
} from './notification-incident-query-performance-report.mjs';
import {
  notificationIncidentSeedTarget,
  parseNotificationIncidentSeedArgs,
} from './notification-incident-performance-seed.mjs';

test('keeps notification incident performance samples bounded and parses the post-resolution date', () => {
  const parsed = parseNotificationIncidentPerformanceArgs([
    '--samples=20', '--observed-after=2026-01-02T00:00:00.000Z', '--allow-local',
  ]);
  assert.equal(parsed.samples, 20);
  assert.equal(parsed.observedAfter.toISOString(), '2026-01-02T00:00:00.000Z');
  assert.throws(() => parseNotificationIncidentPerformanceArgs(['--samples=19']), /20 to 100/);
  assert.throws(() => parseNotificationIncidentPerformanceArgs(['--observed-after=nope']), /Invalid/);
});

test('requires explicit local performance safety gates for measurement and seed', () => {
  const localUrl = 'postgresql://operator:redacted@localhost:5432/massage_vn_perf_local';
  assert.throws(
    () => notificationIncidentPerformanceTarget(localUrl, 'local', false),
    /--allow-local/,
  );
  assert.equal(notificationIncidentPerformanceTarget(localUrl, 'local', true).kind, 'local');
  assert.equal(notificationIncidentSeedTarget(localUrl).databaseName, 'massage_vn_perf_local');
  assert.throws(
    () => notificationIncidentSeedTarget('postgresql://operator:redacted@localhost:5432/massage_vn'),
    /massage_vn_perf_/,
  );
  assert.deepEqual(parseNotificationIncidentSeedArgs([]), {
    attemptsPerNotification: 3,
    notificationCount: 200_000,
    useLocalPerformanceClone: false,
  });
});

test('requires design volume and a no-spill p95 before passing the performance gate', () => {
  assert.equal(notificationIncidentPerformanceDecision({
    deliveryRows: 599_999, matchingRows: 200_000, p95Ms: 100, targetKind: 'local', tempBlocks: 0,
  }).outcome, 'insufficient-design-volume-evidence');
  assert.equal(notificationIncidentPerformanceDecision({
    deliveryRows: 600_000, matchingRows: 200_000, p95Ms: 1_001, targetKind: 'local', tempBlocks: 0,
  }).outcome, 'query-or-index-review-required');
  assert.equal(notificationIncidentPerformanceDecision({
    deliveryRows: 600_000, matchingRows: 200_000, p95Ms: 100, targetKind: 'local', tempBlocks: 1,
  }).outcome, 'query-or-index-review-required');
  assert.equal(notificationIncidentPerformanceDecision({
    deliveryRows: 600_000, matchingRows: 200_000, p95Ms: 100,
    syncP95Ms: 5_001, targetKind: 'local', tempBlocks: 0,
  }).outcome, 'query-or-index-review-required');
  assert.equal(notificationIncidentPerformanceDecision({
    deliveryRows: 600_000, matchingRows: 200_000, p95Ms: 100,
    syncP95Ms: 2_000, syncTempBlocks: 1, targetKind: 'local', tempBlocks: 0,
  }).outcome, 'query-or-index-review-required');
  assert.equal(notificationIncidentPerformanceDecision({
    deliveryRows: 600_000, matchingRows: 200_000, p95Ms: 100,
    syncP95Ms: 2_000, targetKind: 'local', tempBlocks: 0,
  }).outcome, 'design-volume-performance-gate-pass');
});

test('summarizes scan, buffer, sort, and temp evidence without retaining SQL values', () => {
  const summary = summarizeNotificationIncidentPlan([{
    'Execution Time': 48.5,
    'Planning Time': 0.4,
    Plan: {
      'Node Type': 'Limit',
      'Shared Hit Blocks': 10,
      'Shared Read Blocks': 2,
      'Temp Read Blocks': 1,
      'Temp Written Blocks': 1,
      Plans: [{
        'Node Type': 'Seq Scan', 'Relation Name': 'NotificationDelivery',
        'Actual Rows': 600_000, 'Rows Removed by Filter': 10,
      }, {
        'Node Type': 'Index Scan', 'Relation Name': 'Notification',
        'Index Name': 'Notification_pkey', 'Actual Loops': 500,
        'Sort Method': 'quicksort', 'Temp Read Blocks': 2,
      }],
    },
  }]);
  assert.equal(summary.executionTimeMs, 48.5);
  assert.equal(summary.sequentialScans[0].relation, 'NotificationDelivery');
  assert.equal(summary.indexScans[0].indexName, 'Notification_pkey');
  assert.equal(summary.tempBlocks, 4);
  assert.deepEqual(summary.sortMethods, ['quicksort']);
});

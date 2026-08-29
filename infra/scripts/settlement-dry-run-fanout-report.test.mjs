import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildSettlementDryRunFanoutReport,
  parseSettlementDryRunFanoutEvents,
} from './settlement-dry-run-fanout-report.mjs';

function fanoutEvent(overrides = {}) {
  return {
    event: 'booking_settlement_gap_dry_run_fanout',
    status: 'ok',
    track: 'historical-ready',
    evaluated: 5,
    durationMs: 100,
    candidateLoadMs: 20,
    candidateQueryCount: 2,
    previewMs: 80,
    previewCallCount: 5,
    totalMatched: 5,
    truncated: false,
    observedAt: '2026-08-25T12:00:00.000Z',
    ...overrides,
  };
}

test('parses raw, wrapped, and rolling-deploy legacy fanout events only', () => {
  const current = fanoutEvent();
  const legacy = fanoutEvent({ status: undefined, track: undefined, observedAt: undefined });
  const events = parseSettlementDryRunFanoutEvents(
    [
      'unrelated output',
      JSON.stringify(current),
      JSON.stringify({ message: JSON.stringify({ ...current, durationMs: 120 }) }),
      JSON.stringify(legacy),
      JSON.stringify({ ...current, status: 'bad' }),
    ].join('\n'),
  );

  assert.equal(events.length, 3);
  assert.deepEqual(events.map((event) => event.durationMs), [100, 120, 100]);
  assert.equal(events[2]?.status, 'ok');
  assert.equal(events[2]?.track, 'historical-ready');
  assert.equal(events[2]?.observedAt, null);
});

test('reports latency, errors, truncation, and query regressions by evaluated bucket', () => {
  const events = [
    ...Array.from({ length: 20 }, (_, index) =>
      fanoutEvent({ durationMs: 100 + index, previewMs: 80 + index }),
    ),
    ...Array.from({ length: 20 }, (_, index) =>
      fanoutEvent({ evaluated: 25, durationMs: 1_000 + index, previewCallCount: 25 }),
    ),
    fanoutEvent({
      status: 'failed',
      evaluated: 66,
      durationMs: 90,
      failureStage: 'preview',
      previewCallCount: 5,
      totalMatched: 66,
      truncated: true,
    }),
    ...Array.from({ length: 20 }, () =>
      fanoutEvent({ evaluated: 0, candidateQueryCount: 3, previewCallCount: 0, totalMatched: 0 }),
    ),
  ];

  const report = buildSettlementDryRunFanoutReport(events);
  const zero = report.scopes.find((scope) => scope.evaluatedBucket === '0');
  const small = report.scopes.find((scope) => scope.evaluatedBucket === '1-10');
  const medium = report.scopes.find((scope) => scope.evaluatedBucket === '11-50');
  const large = report.scopes.find((scope) => scope.evaluatedBucket === '51-100');

  assert.equal(zero?.decision, 'INVESTIGATE_QUERY_REGRESSION');
  assert.equal(small?.decision, 'KEEP_CURRENT_FANOUT');
  assert.deepEqual(small?.durationMs, {
    samples: 20,
    p50Ms: 109,
    p95Ms: 118,
    p99Ms: 119,
    maxMs: 119,
  });
  assert.equal(medium?.decision, 'REVIEW_BULK_API');
  assert.equal(large?.decision, 'INVESTIGATE_FAILURES');
  assert.equal(large?.errorRate, 1);
  assert.equal(large?.truncationRate, 1);
  assert.deepEqual(large?.failureStages, { preview: 1 });
});

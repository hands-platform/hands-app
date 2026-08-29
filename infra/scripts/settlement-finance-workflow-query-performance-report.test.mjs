import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseSettlementFinancePerformanceArgs,
  settlementFinancePerformanceScenarios,
  settlementFinancePerformanceTarget,
} from './settlement-finance-workflow-query-performance-report.mjs';

test('requires explicit local authorization and redacts the database secret', () => {
  assert.throws(
    () => settlementFinancePerformanceTarget(
      'postgresql://user:secret@localhost:5432/hands',
      'local',
      false,
    ),
    /--allow-local/,
  );
  const target = settlementFinancePerformanceTarget(
    'postgresql://user:secret@localhost:5432/hands',
    'local',
    true,
  );
  assert.deepEqual(Object.keys(target).sort(), ['fingerprint', 'isLocal', 'kind']);
  assert.equal(JSON.stringify(target).includes('secret'), false);
});

test('keeps latency sampling and pagination bounded', () => {
  const args = parseSettlementFinancePerformanceArgs([
    '--concurrent-pair',
    '--samples=20',
    '--skip=100',
    '--scope=coupon',
    '--take=25',
  ]);
  assert.equal(args.concurrentPair, true);
  assert.equal(args.samples, 20);
  assert.equal(args.scope, 'coupon');
  assert.equal(args.skip, 100);
  assert.equal(args.take, 25);
  assert.throws(
    () => parseSettlementFinancePerformanceArgs(['--samples=19']),
    /20 to 100/,
  );
});

test('covers reversal integrity and coupon list-summary planner scopes', () => {
  const scenarios = settlementFinancePerformanceScenarios();
  assert.deepEqual(
    scenarios.map((scenario) => scenario.name),
    [
      'reversal-integrity-needs-action',
      'reversal-integrity-all-records',
      'coupon-needs-action',
      'coupon-all-records',
      'coupon-reversed-corrected',
    ],
  );
  assert.equal(scenarios[0].options.source, 'BOOKING_SETTLEMENT_REVERSAL');
  assert.equal(scenarios.filter((scenario) => scenario.queryBuilder === 'coupon').length, 3);
  assert.equal(settlementFinancePerformanceScenarios('coupon').length, 3);
  assert.equal(settlementFinancePerformanceScenarios('reversal').length, 2);
});

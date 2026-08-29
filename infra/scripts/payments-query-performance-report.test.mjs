import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parsePaymentsPerformanceArgs,
  paymentsPerformanceTarget,
  summarizePaymentsPlan,
} from './payments-query-performance-report.mjs';

test('requires explicit local authorization and keeps the target secret', () => {
  assert.throws(
    () => paymentsPerformanceTarget('postgresql://user:secret@localhost:5432/hands', 'local', false),
    /--allow-local/,
  );
  const target = paymentsPerformanceTarget(
    'postgresql://user:secret@localhost:5432/hands',
    'local',
    true,
  );
  assert.deepEqual(Object.keys(target).sort(), ['fingerprint', 'isLocal', 'kind']);
  assert.equal(JSON.stringify(target).includes('secret'), false);
});

test('keeps p95 samples bounded and rejects invalid arguments', () => {
  assert.equal(parsePaymentsPerformanceArgs(['--samples=20']).samples, 20);
  assert.throws(() => parsePaymentsPerformanceArgs(['--samples=19']), /20 to 100/);
});

test('summarizes index and sequential scan evidence from JSON plans', () => {
  const summary = summarizePaymentsPlan([{
    'Execution Time': 12.5,
    'Planning Time': 0.4,
    Plan: {
      'Node Type': 'Nested Loop',
      'Shared Hit Blocks': 8,
      Plans: [
        {
          'Actual Loops': 10,
          'Index Name': 'PaymentCallbackAttempt_paymentId_createdAt_idx',
          'Node Type': 'Index Scan',
          'Relation Name': 'PaymentCallbackAttempt',
        },
        {
          'Actual Rows': 100,
          'Node Type': 'Seq Scan',
          'Relation Name': 'Payment',
          'Rows Removed by Filter': 900,
        },
      ],
    },
  }]);

  assert.equal(summary.executionTimeMs, 12.5);
  assert.equal(summary.indexScans[0].indexName, 'PaymentCallbackAttempt_paymentId_createdAt_idx');
  assert.deepEqual(summary.sequentialScans[0], {
    actualRows: 100,
    relation: 'Payment',
    rowsRemovedByFilter: 900,
  });
});

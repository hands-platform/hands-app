import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parsePayoutsPerformanceArgs,
  payoutsPerformanceTarget,
  summarizePayoutsPlan,
} from './payouts-query-performance-report.mjs';

test('requires explicit local authorization and keeps the target secret', () => {
  assert.throws(
    () => payoutsPerformanceTarget('postgresql://user:secret@localhost:5432/hands', 'local', false),
    /--allow-local/,
  );
  const target = payoutsPerformanceTarget(
    'postgresql://user:secret@localhost:5432/hands',
    'local',
    true,
  );
  assert.deepEqual(Object.keys(target).sort(), ['fingerprint', 'isLocal', 'kind']);
  assert.equal(JSON.stringify(target).includes('secret'), false);
});

test('keeps p95 samples bounded and rejects invalid arguments', () => {
  assert.equal(parsePayoutsPerformanceArgs(['--samples=20']).samples, 20);
  assert.throws(() => parsePayoutsPerformanceArgs(['--samples=19']), /20 to 100/);
});

test('summarizes index, sequential scan, buffer, and temp evidence', () => {
  const summary = summarizePayoutsPlan([
    {
      'Execution Time': 8.5,
      'Planning Time': 0.3,
      Plan: {
        'Node Type': 'Nested Loop',
        'Shared Hit Blocks': 12,
        Plans: [
          {
            'Actual Loops': 4,
            'Index Name': 'ProviderWalletLedgerEntry_payoutBatchId_idx',
            'Node Type': 'Index Scan',
            'Relation Name': 'ProviderWalletLedgerEntry',
          },
          {
            'Actual Rows': 154,
            'Node Type': 'Seq Scan',
            'Relation Name': 'ProviderPayoutBatch',
            'Rows Removed by Filter': 0,
            'Temp Written Blocks': 2,
          },
        ],
      },
    },
  ]);

  assert.equal(summary.executionTimeMs, 8.5);
  assert.equal(summary.indexScans[0].indexName, 'ProviderWalletLedgerEntry_payoutBatchId_idx');
  assert.equal(summary.rootBuffers.sharedHit, 12);
  assert.equal(summary.sequentialScans[0].relation, 'ProviderPayoutBatch');
  assert.equal(summary.tempBlocks, 2);
});

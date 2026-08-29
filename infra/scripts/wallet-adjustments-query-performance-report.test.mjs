import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseWalletAdjustmentsPerformanceArgs,
  summarizeWalletAdjustmentsPlan,
  walletAdjustmentsPerformanceDecision,
  walletAdjustmentsPerformanceTarget,
} from './wallet-adjustments-query-performance-report.mjs';

test('requires explicit local authorization and keeps the target secret', () => {
  assert.throws(
    () => walletAdjustmentsPerformanceTarget(
      'postgresql://user:secret@localhost:5432/hands',
      'local',
      false,
    ),
    /--allow-local/,
  );
  const target = walletAdjustmentsPerformanceTarget(
    'postgresql://user:secret@localhost:5432/hands',
    'local',
    true,
  );
  assert.deepEqual(Object.keys(target).sort(), ['fingerprint', 'isLocal', 'kind']);
  assert.equal(JSON.stringify(target).includes('secret'), false);
});

test('keeps p95 samples bounded and rejects invalid arguments', () => {
  assert.equal(parseWalletAdjustmentsPerformanceArgs(['--samples=20']).samples, 20);
  assert.throws(
    () => parseWalletAdjustmentsPerformanceArgs(['--samples=19']),
    /20 to 100/,
  );
});

test('summarizes query plan evidence without retaining SQL or parameters', () => {
  const summary = summarizeWalletAdjustmentsPlan([{
    'Execution Time': 12.5,
    'Planning Time': 0.4,
    Plan: {
      'Node Type': 'Nested Loop',
      'Shared Hit Blocks': 8,
      Plans: [
        {
          'Actual Loops': 1,
          'Index Name': 'ManualWalletAdjustmentRequest_status_createdAt_idx',
          'Node Type': 'Index Scan',
          'Relation Name': 'ManualWalletAdjustmentRequest',
        },
        {
          'Actual Rows': 100,
          'Node Type': 'Seq Scan',
          'Relation Name': 'CustomerWalletLedgerEntry',
          'Rows Removed by Filter': 900,
          'Temp Written Blocks': 2,
        },
      ],
    },
  }]);

  assert.equal(summary.indexScans[0].relation, 'ManualWalletAdjustmentRequest');
  assert.equal(summary.sequentialScans[0].rowsRemovedByFilter, 900);
  assert.equal(summary.rootBuffers.sharedHit, 8);
  assert.equal(summary.tempBlocks, 2);
});

test('requires remote saturated evidence before approving candidate reduction', () => {
  assert.equal(walletAdjustmentsPerformanceDecision({
    candidateCount: 10_000,
    p95Ms: 900,
    target: { isLocal: true },
  }).outcome, 'insufficient-production-sized-evidence');
  assert.equal(walletAdjustmentsPerformanceDecision({
    candidateCount: 9_999,
    p95Ms: 900,
    target: { isLocal: false },
  }).outcome, 'insufficient-production-sized-evidence');
  assert.equal(walletAdjustmentsPerformanceDecision({
    candidateCount: 10_000,
    p95Ms: 900,
    target: { isLocal: false },
  }).outcome, 'approve-candidate-query-reduction');
  assert.equal(walletAdjustmentsPerformanceDecision({
    candidateCount: 10_000,
    p95Ms: 500,
    target: { isLocal: false },
  }).outcome, 'retain-current-query-until-new-evidence');
});

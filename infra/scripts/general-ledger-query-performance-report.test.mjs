import assert from 'node:assert/strict';
import test from 'node:test';

import {
  generalLedgerPerformanceScenarios,
  generalLedgerPerformanceTarget,
  parseGeneralLedgerPerformanceArgs,
  summarizeGeneralLedgerPlan,
} from './general-ledger-query-performance-report.mjs';

test('requires explicit local authorization and never exposes the database secret', () => {
  assert.throws(
    () => generalLedgerPerformanceTarget('postgresql://user:secret@localhost:5432/hands', 'local', false),
    /--allow-local/,
  );
  const target = generalLedgerPerformanceTarget(
    'postgresql://user:secret@localhost:5432/hands',
    'local',
    true,
  );
  assert.deepEqual(Object.keys(target).sort(), ['fingerprint', 'isLocal', 'kind']);
  assert.equal(JSON.stringify(target).includes('secret'), false);
});

test('keeps p95 samples bounded and rejects invalid arguments', () => {
  assert.equal(parseGeneralLedgerPerformanceArgs(['--samples=20']).samples, 20);
  assert.equal(
    parseGeneralLedgerPerformanceArgs(['--scenario=recent-30d-no-search']).scenario,
    'recent-30d-no-search',
  );
  assert.throws(() => parseGeneralLedgerPerformanceArgs(['--samples=19']), /20 to 100/);
});

test('covers default, budget-range, all-records, exact-ID, and account-search planner cases', () => {
  const scenarios = generalLedgerPerformanceScenarios({
    accountCode: '4110',
    batchId: 'journal-batch-1',
  });
  assert.deepEqual(
    scenarios.map((scenario) => scenario.name),
    [
      'needs-action-no-search',
      'recent-30d-no-search',
      'all-records-no-search',
      'exact-id-search',
      'account-search',
    ],
  );
  assert.equal(scenarios[1].options.range, '30d');
  assert.equal(scenarios[3].options.q, 'journal-batch-1');
  assert.equal(scenarios[4].options.q, '4110');
});

test('summarizes planner nodes, buffers, estimates, parallelism, and temp blocks', () => {
  const summary = summarizeGeneralLedgerPlan([{
    'Execution Time': 12.5,
    'Planning Time': 0.4,
    Settings: { work_mem: '4MB' },
    Plan: {
      'Actual Loops': 1,
      'Actual Rows': 10,
      'Node Type': 'Nested Loop',
      'Plan Rows': 12,
      'Shared Hit Blocks': 8,
      Plans: [
        {
          'Actual Loops': 1,
          'Actual Rows': 10,
          'Index Name': 'AccountingJournalEntry_batchId_idx',
          'Node Type': 'Index Scan',
          'Plan Rows': 10,
          'Relation Name': 'AccountingJournalEntry',
          'Workers Launched': 2,
          'Workers Planned': 2,
        },
        {
          'Actual Loops': 1,
          'Actual Rows': 100,
          'Node Type': 'Seq Scan',
          'Plan Rows': 90,
          'Relation Name': 'AccountingJournalBatch',
          'Rows Removed by Filter': 900,
          'Temp Written Blocks': 2,
        },
      ],
    },
  }]);

  assert.equal(summary.executionTimeMs, 12.5);
  assert.equal(summary.settings.work_mem, '4MB');
  assert.equal(summary.rootBuffers.sharedHit, 8);
  assert.equal(summary.nodes[1].indexName, 'AccountingJournalEntry_batchId_idx');
  assert.equal(summary.nodes[1].workersLaunched, 2);
  assert.equal(summary.nodes[2].rowsRemovedByFilter, 900);
  assert.equal(summary.tempBlocks, 2);
});

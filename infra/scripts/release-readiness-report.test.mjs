import assert from 'node:assert/strict';
import test from 'node:test';

import { buildReleaseReadinessReport } from './lib/release-readiness-report.mjs';

test('combines setup and network failures without copying configured secrets', () => {
  const report = buildReleaseReadinessReport(
    {
      ok: false,
      checks: [
        { category: 'payments', name: 'MoMo credentials', status: 'WARN', secret: 'must-not-copy' },
        { category: 'referrals', name: 'iOS store URLs', status: 'DEFERRED' },
      ],
      nextActions: ['Configure MoMo sandbox credentials.'],
    },
    {
      ok: false,
      results: [{ name: 'api-readiness', status: 'FAIL', error: 'DNS lookup failed', url: 'secret-query' }],
    },
  );

  assert.equal(report.ok, false);
  assert.deepEqual(report.setup.blockers, [
    { category: 'payments', name: 'MoMo credentials', status: 'WARN' },
  ]);
  assert.deepEqual(report.network.blockers, [
    { name: 'api-readiness', status: 'FAIL', error: 'DNS lookup failed' },
  ]);
  assert.doesNotMatch(JSON.stringify(report), /must-not-copy|secret-query/);
});

test('passes only when both setup and network gates pass', () => {
  assert.equal(buildReleaseReadinessReport({ ok: true, checks: [] }, { ok: true, results: [] }).ok, true);
  assert.equal(buildReleaseReadinessReport({ ok: true, checks: [] }, { ok: false, results: [] }).ok, false);
});

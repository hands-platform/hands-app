import assert from 'node:assert/strict';
import test from 'node:test';

import {
  SERVICE_CATALOG_CLEANUP_CONFIRMATION,
  assertReviewedManifest,
  assertServiceCatalogCleanupApplyOptions,
  classifyServiceCatalogCandidate,
  summarizeServiceCatalogCandidates,
} from './lib/service-catalog-cleanup.mjs';

const service = {
  id: 'service-smoke-1',
  serviceGroupKey: 'smoke-run-1',
  durationMin: 60,
  publicationStatus: 'HIDDEN',
  provenance: 'SMOKE_TEST',
  provenanceRunId: 'run-1',
};

test('unreferenced explicit provenance candidate may be deleted', () => {
  const candidate = classifyServiceCatalogCandidate(service, {
    audits: 0,
    bookings: 0,
    payoutRules: 0,
    prices: 0,
  });

  assert.equal(candidate.expectedAction, 'DELETE');
  assert.equal(candidate.provenanceReason, 'Explicit SMOKE_TEST provenance');
});

test('any booking, price, payout, or audit reference forces archive', () => {
  for (const referenceName of ['audits', 'bookings', 'payoutRules', 'prices']) {
    const references = { audits: 0, bookings: 0, payoutRules: 0, prices: 0 };
    references[referenceName] = 1;
    assert.equal(classifyServiceCatalogCandidate(service, references).expectedAction, 'ARCHIVE');
  }
});

test('summary reports action and provenance totals', () => {
  const deleteCandidate = classifyServiceCatalogCandidate(service, {
    audits: 0,
    bookings: 0,
    payoutRules: 0,
    prices: 0,
  });
  const archiveCandidate = classifyServiceCatalogCandidate(
    { ...service, id: 'migration-1', provenance: 'MIGRATION' },
    { audits: 0, bookings: 1, payoutRules: 0, prices: 0 },
  );

  assert.deepEqual(summarizeServiceCatalogCandidates([deleteCandidate, archiveCandidate]), {
    candidateCount: 2,
    byAction: { ARCHIVE: 1, DELETE: 1 },
    byProvenance: { MIGRATION: 1, SMOKE_TEST: 1 },
  });
});

test('apply requires a reviewed manifest and exact confirmation', () => {
  assert.throws(
    () => assertServiceCatalogCleanupApplyOptions({ apply: true }),
    /--manifest/,
  );
  assert.throws(
    () =>
      assertServiceCatalogCleanupApplyOptions({
        apply: true,
        manifestPath: 'reviewed.json',
        confirmation: 'yes',
      }),
    /--confirm/,
  );
  assert.doesNotThrow(() =>
    assertServiceCatalogCleanupApplyOptions({
      apply: true,
      manifestPath: 'reviewed.json',
      confirmation: SERVICE_CATALOG_CLEANUP_CONFIRMATION,
    }),
  );
});

test('apply accepts only a dry-run manifest contract', () => {
  assert.doesNotThrow(() =>
    assertReviewedManifest({
      schemaVersion: 1,
      mode: 'dry-run',
      candidates: [{ id: 'service-1', expectedAction: 'ARCHIVE' }],
    }),
  );
  assert.throws(
    () => assertReviewedManifest({ schemaVersion: 1, mode: 'apply', candidates: [] }),
    /dry-run manifest/,
  );
});

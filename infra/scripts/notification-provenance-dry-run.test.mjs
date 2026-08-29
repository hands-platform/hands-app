import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildNotificationProvenanceDryRunReport,
  classifyNotificationProvenanceEvidence,
  sanitizedDatabaseTarget,
} from './lib/notification-provenance-dry-run.mjs';

test('classifies only explicit recipient or booking fixture evidence as synthetic', () => {
  assert.equal(classifyNotificationProvenanceEvidence(row({ recipientFixture: true })).classification, 'synthetic');
  assert.equal(classifyNotificationProvenanceEvidence(row({ bookingMetadataSynthetic: true })).classification, 'synthetic');
  assert.equal(classifyNotificationProvenanceEvidence(row({ bookingOwnerFixture: true })).classification, 'synthetic');
});

test('classifies only explicit booking production origin as production', () => {
  assert.deepEqual(
    classifyNotificationProvenanceEvidence(row({ bookingMetadataProduction: true })),
    {
      classification: 'production',
      conflict: false,
      productionRules: ['booking_explicit_production_origin'],
      syntheticRules: [],
    },
  );
});

test('keeps conflicts and evidence-free rows unknown', () => {
  assert.deepEqual(
    classifyNotificationProvenanceEvidence(row({
      bookingMetadataProduction: true,
      recipientFixture: true,
    })),
    {
      classification: 'unknown',
      conflict: true,
      productionRules: ['booking_explicit_production_origin'],
      syntheticRules: ['recipient_fixture_identity'],
    },
  );
  assert.equal(classifyNotificationProvenanceEvidence(row()).classification, 'unknown');
});

test('builds a deterministic masked report with a complete partition', () => {
  const rows = [
    row({ id: 'notification-production', bookingMetadataProduction: true, type: 'booking.opened' }),
    row({ id: 'notification-synthetic', recipientFixture: true, type: 'booking.requested' }),
    row({ id: 'notification-conflict', bookingMetadataProduction: true, bookingMetadataSynthetic: true }),
    row({ id: 'notification-unknown' }),
  ];
  const input = {
    databaseTarget: 'postgresql://localhost:5432/hands',
    generatedAt: '2026-08-27T10:00:00.000Z',
    rows,
    scopeCounts: { total: 6, production: 1, synthetic: 1, unknown: 4 },
    snapshotId: '1:1:',
    transactionReadOnly: 'on',
  };
  const report = buildNotificationProvenanceDryRunReport(input);
  const repeat = buildNotificationProvenanceDryRunReport(input);

  assert.deepEqual(report.proposedUnknownPartition, {
    productionCandidates: 1,
    syntheticCandidates: 1,
    reviewedUnknown: 2,
    conflicts: 1,
  });
  assert.deepEqual(report.invariants, {
    currentScopesSumMatchesTotal: true,
    dryRunPartitionMatchesCurrentUnknown: true,
    conflictsRemainUnknown: true,
    noWritesPerformed: true,
  });
  assert.deepEqual(report.hashes, repeat.hashes);
  assert.doesNotMatch(JSON.stringify(report.maskedSamples), /notification-(production|synthetic|conflict|unknown)/u);
});

test('sanitizes database credentials', () => {
  assert.equal(
    sanitizedDatabaseTarget('postgresql://secret:password@localhost:5432/hands?schema=public'),
    'postgresql://localhost:5432/hands',
  );
});

function row(overrides = {}) {
  return {
    id: 'notification-unknown',
    type: 'booking.opened',
    createdAt: new Date('2026-08-27T00:00:00.000Z'),
    rawScope: '<missing>',
    recipientFixture: false,
    bookingMetadataSynthetic: false,
    bookingMetadataProduction: false,
    bookingOwnerFixture: false,
    hasBookingId: false,
    bookingFound: false,
    ...overrides,
  };
}

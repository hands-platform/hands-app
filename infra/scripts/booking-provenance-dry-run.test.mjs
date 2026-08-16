import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildBookingProvenanceManifest,
  classifyBookingProvenance,
} from './lib/booking-provenance-classifier.mjs';

test('keeps only explicit production records as production', () => {
  assert.equal(classifyBookingProvenance({ metadata: { dataOrigin: 'PRODUCTION' } }).action, 'KEEP_PRODUCTION');
  assert.equal(classifyBookingProvenance({ metadata: {} }).action, 'REVIEW_UNKNOWN');
});

test('uses explicit fixture evidence but does not auto-classify names or IDs', () => {
  assert.equal(classifyBookingProvenance({ metadata: { smoke: 'booking-list' } }).action, 'MARK_SYNTHETIC');
  const heuristicOnly = classifyBookingProvenance({ id: 'smoke_missing_marker', metadata: {} });
  assert.equal(heuristicOnly.action, 'REVIEW_UNKNOWN');
  assert.equal(heuristicOnly.heuristicEvidence.length, 1);
});

test('reports conflicting server-owned evidence without allowing a write', () => {
  const classification = classifyBookingProvenance({
    metadata: { auditFixture: 'booking-list', dataOrigin: 'PRODUCTION' },
  });
  assert.equal(classification.action, 'CONFLICT');
  assert.equal(classification.automaticWriteAllowed, false);
});

test('builds a deterministic, read-only manifest', () => {
  const records = [
    { id: 'b', metadata: {} },
    { id: 'a', metadata: { dataOrigin: 'PRODUCTION' } },
  ];
  const first = buildBookingProvenanceManifest(records, '2026-08-13T00:00:00.000Z');
  const second = buildBookingProvenanceManifest([...records].reverse(), '2026-08-13T00:00:00.000Z');
  assert.deepEqual(first, second);
  assert.equal(first.applyEnabled, false);
  assert.deepEqual(first.rows.map((row) => row.bookingId), ['a', 'b']);
  assert.equal(first.rows[0].currentMarkers.dataOrigin, 'PRODUCTION');
  assert.equal(first.counts.KEEP_PRODUCTION, 1);
  assert.equal(first.counts.REVIEW_UNKNOWN, 1);
});

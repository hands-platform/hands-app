import { createHash } from 'node:crypto';

const ACTIONS = [
  'KEEP_PRODUCTION',
  'MARK_SYNTHETIC',
  'REVIEW_UNKNOWN',
  'CONFLICT',
];

export function classifyBookingProvenance(record) {
  const metadata = objectValue(record.metadata);
  const origin = stringValue(metadata.dataOrigin)?.toUpperCase() ?? null;
  const explicitFixtureEvidence = collectExplicitFixtureEvidence(record, metadata);
  const heuristicEvidence = collectHeuristicEvidence(record);

  if (origin === 'PRODUCTION' && explicitFixtureEvidence.length > 0) {
    return result('CONFLICT', origin, explicitFixtureEvidence, heuristicEvidence);
  }
  if (origin === 'PRODUCTION') {
    return result('KEEP_PRODUCTION', origin, [], heuristicEvidence);
  }
  if (origin === 'SYNTHETIC' || explicitFixtureEvidence.length > 0) {
    return result('MARK_SYNTHETIC', origin, explicitFixtureEvidence, heuristicEvidence);
  }

  const originEvidence = origin ? [`unsupported dataOrigin:${origin}`] : ['dataOrigin missing'];
  return result('REVIEW_UNKNOWN', origin, originEvidence, heuristicEvidence);
}

export function buildBookingProvenanceManifest(records, generatedAt = new Date().toISOString()) {
  const rows = [...records]
    .sort((left, right) => String(left.id).localeCompare(String(right.id)))
    .map((record) => ({
      bookingId: String(record.id),
      createdAt: dateValue(record.createdAt),
      customerProfileId: record.customerProfileId ?? null,
      preferredProviderId: record.preferredProviderId ?? null,
      selectedProviderId: record.selectedProviderId ?? null,
      currentMarkers: currentMarkers(record),
      ...classifyBookingProvenance(record),
    }));
  const counts = Object.fromEntries(ACTIONS.map((action) => [
    action,
    rows.filter((row) => row.action === action).length,
  ]));
  const digestPayload = rows.map(({ bookingId, action, evidence, heuristicEvidence, origin }) => ({
    action,
    bookingId,
    evidence,
    heuristicEvidence,
    origin,
  }));

  return {
    schemaVersion: 1,
    mode: 'DRY_RUN_ONLY',
    generatedAt,
    applyEnabled: false,
    totalBookingCount: rows.length,
    counts,
    manifestDigest: createHash('sha256').update(JSON.stringify(digestPayload)).digest('hex'),
    rows,
  };
}

function collectExplicitFixtureEvidence(record, metadata) {
  const evidence = [];
  if (metadata.smokeFixture === true) evidence.push('metadata.smokeFixture=true');
  if (metadata.auditFixture !== undefined && metadata.auditFixture !== null) {
    evidence.push('metadata.auditFixture present');
  }
  if (metadata.smoke !== undefined && metadata.smoke !== null) {
    evidence.push('metadata.smoke fixture marker');
  }
  if (metadata.fixture !== undefined && metadata.fixture !== null) evidence.push('metadata.fixture marker');
  if (record.customerFixtureKind) evidence.push('customer user fixtureKind present');
  if (record.preferredProviderFixtureKind) evidence.push('preferred Partner user fixtureKind present');
  if (record.selectedProviderFixtureKind) evidence.push('selected Partner user fixtureKind present');
  return evidence.sort();
}

function collectHeuristicEvidence(record) {
  const values = [
    record.id,
    record.customerProfileId,
    record.preferredProviderId,
    record.selectedProviderId,
    record.customerName,
    record.preferredProviderName,
    record.selectedProviderName,
  ];
  const evidence = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = String(value).toLowerCase();
    if (/(^|[_\s-])(smoke|demo|seed|audit)([_\s-]|$)/.test(normalized)) {
      evidence.push(`heuristic identifier/name:${String(value)}`);
    }
  }
  return [...new Set(evidence)].sort();
}

function result(action, origin, evidence, heuristicEvidence) {
  return {
    action,
    origin: origin ?? 'UNKNOWN',
    evidence,
    heuristicEvidence,
    automaticWriteAllowed: false,
  };
}

function currentMarkers(record) {
  const metadata = objectValue(record.metadata);
  return {
    auditFixture: metadata.auditFixture ?? null,
    dataOrigin: stringValue(metadata.dataOrigin)?.toUpperCase() ?? null,
    fixture: metadata.fixture ?? null,
    smoke: metadata.smoke ?? null,
    smokeFixture: metadata.smokeFixture ?? null,
    customerFixtureKind: record.customerFixtureKind ?? null,
    preferredProviderFixtureKind: record.preferredProviderFixtureKind ?? null,
    selectedProviderFixtureKind: record.selectedProviderFixtureKind ?? null,
  };
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function dateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

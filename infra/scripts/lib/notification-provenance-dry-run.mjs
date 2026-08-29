import { createHash } from 'node:crypto';

export const NOTIFICATION_PROVENANCE_POLICY_VERSION = 1;

const SYNTHETIC_RULES = [
  ['recipient_fixture_identity', 'recipientFixture'],
  ['booking_explicit_synthetic_metadata', 'bookingMetadataSynthetic'],
  ['booking_fixture_owner_identity', 'bookingOwnerFixture'],
];

const PRODUCTION_RULES = [
  ['booking_explicit_production_origin', 'bookingMetadataProduction'],
];

export function classifyNotificationProvenanceEvidence(row) {
  const syntheticRules = matchingRules(row, SYNTHETIC_RULES);
  const productionRules = matchingRules(row, PRODUCTION_RULES);
  const conflict = syntheticRules.length > 0 && productionRules.length > 0;

  if (conflict) {
    return { classification: 'unknown', conflict, productionRules, syntheticRules };
  }
  if (syntheticRules.length > 0) {
    return { classification: 'synthetic', conflict, productionRules, syntheticRules };
  }
  if (productionRules.length > 0) {
    return { classification: 'production', conflict, productionRules, syntheticRules };
  }
  return { classification: 'unknown', conflict, productionRules, syntheticRules };
}

export function buildNotificationProvenanceDryRunReport({
  databaseTarget,
  generatedAt,
  rows,
  sampleLimit = 20,
  scopeCounts,
  snapshotId,
  transactionReadOnly,
}) {
  const classified = rows
    .map((row) => ({ ...row, ...classifyNotificationProvenanceEvidence(row) }))
    .sort((left, right) => left.id.localeCompare(right.id));
  const production = classified.filter((row) => row.classification === 'production');
  const synthetic = classified.filter((row) => row.classification === 'synthetic');
  const unknown = classified.filter((row) => row.classification === 'unknown');
  const conflicts = classified.filter((row) => row.conflict);
  const evidenceRules = [...SYNTHETIC_RULES, ...PRODUCTION_RULES].map(([rule, property]) => ({
    rule,
    count: classified.filter((row) => row[property] === true).length,
  }));
  const currentTotal = scopeCounts.production + scopeCounts.synthetic + scopeCounts.unknown;

  return {
    ok: true,
    mode: 'READ_ONLY_DRY_RUN',
    policyVersion: NOTIFICATION_PROVENANCE_POLICY_VERSION,
    generatedAt,
    timeZone: 'Asia/Ho_Chi_Minh',
    databaseTarget,
    snapshot: {
      id: snapshotId,
      transactionReadOnly,
      isolationLevel: 'REPEATABLE READ',
    },
    currentScopes: {
      ...scopeCounts,
      total: currentTotal,
    },
    proposedUnknownPartition: {
      productionCandidates: production.length,
      syntheticCandidates: synthetic.length,
      reviewedUnknown: unknown.length,
      conflicts: conflicts.length,
    },
    evidenceRules,
    evidenceHealth: {
      rowsWithBookingId: classified.filter((row) => row.hasBookingId).length,
      missingBookingReferences: classified.filter((row) => row.hasBookingId && !row.bookingFound).length,
      firstObservedAt: minDate(classified),
      lastObservedAt: maxDate(classified),
    },
    typeCounts: {
      productionCandidates: countTypes(production),
      syntheticCandidates: countTypes(synthetic),
      reviewedUnknown: countTypes(unknown),
    },
    maskedSamples: {
      productionCandidates: sampleRows(production, sampleLimit),
      syntheticCandidates: sampleRows(synthetic, sampleLimit),
      conflicts: sampleRows(conflicts, sampleLimit),
      reviewedUnknown: sampleRows(unknown, sampleLimit),
    },
    hashes: {
      currentUnknownIdSetSha256: hashRows(classified, (row) => row.id),
      productionCandidateIdSetSha256: hashRows(production, (row) => row.id),
      syntheticCandidateIdSetSha256: hashRows(synthetic, (row) => row.id),
      reviewedUnknownIdSetSha256: hashRows(unknown, (row) => row.id),
      beforeScopeSha256: hashRows(classified, (row) => `${row.id}:${row.rawScope}`),
      proposedScopeSha256: hashRows(classified, (row) => `${row.id}:${row.classification}`),
    },
    invariants: {
      currentScopesSumMatchesTotal: currentTotal === scopeCounts.total,
      dryRunPartitionMatchesCurrentUnknown:
        production.length + synthetic.length + unknown.length === scopeCounts.unknown,
      conflictsRemainUnknown: conflicts.every((row) => row.classification === 'unknown'),
      noWritesPerformed: transactionReadOnly === 'on',
    },
    decision: {
      productionCandidatesApprovedForApply: false,
      syntheticCandidatesApprovedForApply: false,
      reviewedUnknownPreserved: true,
      nextAction:
        'Review the rule counts, masked samples, conflicts, and ID-set hashes. This collector intentionally performs no writes.',
    },
  };
}

export function sanitizedDatabaseTarget(value) {
  if (!value) return 'DATABASE_URL_NOT_SET';
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}:${url.port || 'default'}/${url.pathname.replace(/^\//u, '')}`;
  } catch {
    return 'DATABASE_URL_CONFIGURED';
  }
}

export function notificationIdSetSha256(rows) {
  return hashRows([...rows].sort((left, right) => left.id.localeCompare(right.id)), (row) => row.id);
}

function matchingRules(row, rules) {
  return rules.filter(([, property]) => row[property] === true).map(([rule]) => rule);
}

function countTypes(rows) {
  const counts = new Map();
  for (const row of rows) counts.set(row.type, (counts.get(row.type) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((left, right) => right.count - left.count || left.type.localeCompare(right.type));
}

function sampleRows(rows, limit) {
  return rows.slice(0, limit).map((row) => ({
    maskedId: `sha256:${sha256(row.id).slice(0, 12)}`,
    type: row.type,
    createdAt: toIsoString(row.createdAt),
    syntheticRules: row.syntheticRules,
    productionRules: row.productionRules,
  }));
}

function hashRows(rows, value) {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(`${value(row)}\n`);
  return hash.digest('hex');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function minDate(rows) {
  return rows.length === 0 ? null : toIsoString(rows.reduce((result, row) =>
    new Date(row.createdAt) < new Date(result.createdAt) ? row : result));
}

function maxDate(rows) {
  return rows.length === 0 ? null : toIsoString(rows.reduce((result, row) =>
    new Date(row.createdAt) > new Date(result.createdAt) ? row : result));
}

function toIsoString(value) {
  return new Date(value.createdAt ?? value).toISOString();
}

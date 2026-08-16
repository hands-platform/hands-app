export const SERVICE_CATALOG_CLEANUP_CONFIRMATION = 'APPLY_REVIEWED_SERVICE_CATALOG_MANIFEST';

export function classifyServiceCatalogCandidate(service, references) {
  const normalizedReferences = {
    audits: nonNegativeInteger(references.audits, 'audits'),
    bookings: nonNegativeInteger(references.bookings, 'bookings'),
    payoutRules: nonNegativeInteger(references.payoutRules, 'payoutRules'),
    prices: nonNegativeInteger(references.prices, 'prices'),
  };
  const referenceCount = Object.values(normalizedReferences).reduce((total, count) => total + count, 0);

  return {
    id: service.id,
    serviceGroupKey: service.serviceGroupKey,
    durationMin: service.durationMin,
    publicationStatus: service.publicationStatus,
    provenance: service.provenance,
    provenanceRunId: service.provenanceRunId,
    provenanceReason: `Explicit ${service.provenance} provenance`,
    references: normalizedReferences,
    expectedAction: referenceCount === 0 ? 'DELETE' : 'ARCHIVE',
  };
}

export function summarizeServiceCatalogCandidates(candidates) {
  const byAction = { ARCHIVE: 0, DELETE: 0 };
  const byProvenance = {};

  for (const candidate of candidates) {
    byAction[candidate.expectedAction] += 1;
    byProvenance[candidate.provenance] = (byProvenance[candidate.provenance] ?? 0) + 1;
  }

  return {
    candidateCount: candidates.length,
    byAction,
    byProvenance,
  };
}

export function assertServiceCatalogCleanupApplyOptions({ apply, confirmation, manifestPath }) {
  if (!apply) return;
  if (!manifestPath) {
    throw new Error('Cleanup apply requires --manifest=<reviewed-file>.');
  }
  if (confirmation !== SERVICE_CATALOG_CLEANUP_CONFIRMATION) {
    throw new Error(
      `Cleanup apply requires --confirm=${SERVICE_CATALOG_CLEANUP_CONFIRMATION}.`,
    );
  }
}

export function assertReviewedManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || manifest?.mode !== 'dry-run') {
    throw new Error('Reviewed manifest must be an unmodified Service Catalog dry-run manifest.');
  }
  if (!Array.isArray(manifest.candidates)) {
    throw new Error('Reviewed manifest candidates are missing.');
  }
  for (const candidate of manifest.candidates) {
    if (!candidate?.id || !['ARCHIVE', 'DELETE'].includes(candidate.expectedAction)) {
      throw new Error('Reviewed manifest contains an invalid candidate.');
    }
  }
}

function nonNegativeInteger(value, name) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer.`);
  }
  return value;
}

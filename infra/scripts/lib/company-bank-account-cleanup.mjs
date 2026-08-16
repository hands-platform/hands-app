import { createHash } from 'node:crypto';

export const COMPANY_BANK_ACCOUNT_CLEANUP_CONFIRM =
  'DELETE_REVIEWED_COMPANY_BANK_ACCOUNT_FIXTURES';

export function companyBankAccountCleanupDecision(account) {
  const metadata = plainRecord(account.metadata);
  const explicitFixture =
    account.dataScope === 'SYNTHETIC' &&
    metadata.fixture === true &&
    typeof metadata.fixtureType === 'string';
  const legacyFixtureSignal =
    metadata.smoke === true || /(?:smoke|test)/iu.test(`${account.name ?? ''} ${account.bankName ?? ''}`);
  const pendingApproval = Boolean(plainRecord(metadata.pendingApproval).requestId);
  const references = account.references ?? {};
  const unsupportedDirectReferences = Array.isArray(account.unsupportedDirectReferences)
    ? account.unsupportedDirectReferences
    : [];
  const blockingReferenceCount = [
    references.transactions,
    references.reconciliationMatches,
    references.importBatches,
    references.payments,
    references.refunds,
    references.payouts,
  ].reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);

  if (account.dataScope === 'UNKNOWN') {
    return {
      action: 'manual-review',
      reason: 'Data scope is UNKNOWN; classification requires reviewed evidence.',
    };
  }
  if (!explicitFixture) {
    return {
      action: legacyFixtureSignal ? 'manual-review' : 'retain',
      reason: legacyFixtureSignal
        ? 'Legacy fixture signal has no explicit provenance; do not delete by name.'
        : 'No explicit fixture provenance.',
    };
  }
  if (unsupportedDirectReferences.length > 0) {
    return {
      action: 'manual-review',
      reason: `Reference coverage is incomplete for ${unsupportedDirectReferences.join(', ')}.`,
    };
  }
  if (blockingReferenceCount > 0) {
    return { action: 'retain', reason: `${blockingReferenceCount} finance references must be preserved.` };
  }
  if (pendingApproval) {
    return { action: 'manual-review', reason: 'Pending approval must be resolved before cleanup.' };
  }
  if (account.status === 'ACTIVE') {
    return { action: 'archive', reason: 'Explicit fixture is active; archive before deletion review.' };
  }
  return { action: 'delete-candidate', reason: 'Explicit inactive fixture has no finance references.' };
}

export function buildCompanyBankAccountCleanupManifest(accounts, generatedAt = new Date().toISOString()) {
  const rows = accounts.map((account) => ({
    ...account,
    decision: companyBankAccountCleanupDecision(account),
  }));
  const manifest = {
    contractVersion: 2,
    generatedAt,
    destructiveApplyPerformed: false,
    counts: rows.reduce(
      (counts, row) => ({ ...counts, [row.decision.action]: (counts[row.decision.action] ?? 0) + 1 }),
      {},
    ),
    accounts: rows,
  };
  return { ...manifest, manifestHash: companyBankAccountCleanupManifestHash(manifest) };
}

export function companyBankAccountCleanupManifestHash(manifest) {
  const { manifestHash: _manifestHash, ...reviewed } = manifest;
  return createHash('sha256').update(JSON.stringify(reviewed)).digest('hex');
}

function plainRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

export type BankReconciliationWorkspace = 'operations' | 'imports' | 'manual';

type BankReconciliationSearchParams = Record<string, string | string[] | undefined>;

export function readBankReconciliationWorkspace(
  params: BankReconciliationSearchParams,
): BankReconciliationWorkspace {
  const explicitWorkspace = readParam(params, 'workspace');
  if (
    explicitWorkspace === 'operations' ||
    explicitWorkspace === 'imports' ||
    explicitWorkspace === 'manual'
  ) {
    return explicitWorkspace;
  }

  const confirmation = readParam(params, 'confirm');
  if (
    confirmation === 'batch-owner' ||
    hasAnyParam(params, [
      'assignmentNotice',
      'batchImportId',
      'importPage',
      'importQ',
      'importRange',
      'importReview',
    ])
  ) {
    return 'imports';
  }

  if (hasAnyParam(params, ['bankDuplicateCandidates', 'bankImported', 'bankImportError'])) {
    return 'manual';
  }

  return 'operations';
}

export function bankReconciliationWorkspaceHref(workspace: BankReconciliationWorkspace) {
  return workspace === 'operations'
    ? '/finance-tax/bank-reconciliation'
    : `/finance-tax/bank-reconciliation?workspace=${workspace}`;
}

function hasAnyParam(params: BankReconciliationSearchParams, keys: readonly string[]) {
  return keys.some((key) => Boolean(readParam(params, key)));
}

function readParam(params: BankReconciliationSearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

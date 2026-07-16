import {
  bankReconciliationWorkspaceHref,
  readBankReconciliationWorkspace,
} from './bank-reconciliation-workspace-model';

describe('bank reconciliation workspace model', () => {
  it('defaults to the live operations queue', () => {
    expect(readBankReconciliationWorkspace({})).toBe('operations');
    expect(readBankReconciliationWorkspace({ importReview: 'stale', workspace: 'operations' })).toBe(
      'operations',
    );
    expect(readBankReconciliationWorkspace({ workspace: 'unknown' })).toBe('operations');
    expect(bankReconciliationWorkspaceHref('operations')).toBe('/finance-tax/bank-reconciliation');
  });

  it('supports explicit statement import and manual entry workspaces', () => {
    expect(readBankReconciliationWorkspace({ workspace: 'imports' })).toBe('imports');
    expect(readBankReconciliationWorkspace({ workspace: 'manual' })).toBe('manual');
    expect(bankReconciliationWorkspaceHref('imports')).toBe(
      '/finance-tax/bank-reconciliation?workspace=imports',
    );
    expect(bankReconciliationWorkspaceHref('manual')).toBe(
      '/finance-tax/bank-reconciliation?workspace=manual',
    );
  });

  it('keeps legacy import and manual action redirects in the correct workspace', () => {
    expect(readBankReconciliationWorkspace({ confirm: 'batch-owner' })).toBe('imports');
    expect(readBankReconciliationWorkspace({ importReview: 'stale' })).toBe('imports');
    expect(readBankReconciliationWorkspace({ assignmentNotice: 'assigned' })).toBe('imports');
    expect(readBankReconciliationWorkspace({ bankImportError: 'duplicate' })).toBe('manual');
    expect(readBankReconciliationWorkspace({ bankImported: '1' })).toBe('manual');
  });
});

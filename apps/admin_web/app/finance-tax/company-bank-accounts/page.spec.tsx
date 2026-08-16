import { readFileSync } from 'node:fs';

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGetResult } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import CompanyBankAccountsPage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGetResult: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const source = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const requestFormSource = readFileSync(new URL('./company-bank-account-request-form.tsx', import.meta.url), 'utf8');
const statusDialogSource = readFileSync(new URL('./company-bank-account-status-dialog.tsx', import.meta.url), 'utf8');

const accounts = [
  {
    accountNumberLast4: '0001',
    accountNumberMasked: '****0001',
    bankName: 'VCB',
    currency: 'VND',
    dataScope: 'PRODUCTION',
    id: 'bank-account-1',
    createdAt: '2026-07-14T08:00:00.000Z',
    lifecycleStatus: 'ACTIVE',
    name: 'Operations VND',
    operationalProfile: {
      bankCode: 'VCB',
      direction: 'INBOUND',
      evidenceObjectId: 'finance-evidence/account-1',
      isPrimary: true,
      legalOwnerName: 'HANDS Vietnam Co., Ltd.',
      purpose: 'COLLECTION',
      statementImportTestedAt: '2026-07-14T07:00:00.000Z',
      verificationMethod: 'Bank letter',
      verificationStatus: 'VERIFIED',
      verifiedAt: '2026-07-14T08:00:00.000Z',
      verifiedByAdminId: 'checker-1',
    },
    operations: {
      lastActivityAt: '2026-07-15T08:00:00.000Z',
      openReconciliationCount: 0,
      transactionCount: 4,
    },
    status: 'ACTIVE',
  },
  {
    accountNumberLast4: '0002',
    accountNumberMasked: '****0002',
    bankName: 'ACB',
    currency: 'VND',
    dataScope: 'PRODUCTION',
    id: 'bank-account-2',
    createdAt: '2026-07-13T08:00:00.000Z',
    lifecycleStatus: 'NEVER_ACTIVATED',
    name: 'Dormant settlement account',
    operationalProfile: {
      bankCode: 'ACB', direction: 'BOTH', evidenceObjectId: null, isPrimary: false,
      legalOwnerName: 'HANDS Vietnam Co., Ltd.', purpose: 'RECONCILIATION',
      statementImportTestedAt: null, verificationMethod: null, verificationStatus: 'UNVERIFIED',
      verifiedAt: null, verifiedByAdminId: null,
    },
    operations: { lastActivityAt: '2026-07-13T08:00:00.000Z', openReconciliationCount: 0, transactionCount: 0 },
    status: 'INACTIVE',
  },
];

type CompanyBankAccountFixture = (typeof accounts)[number] & { metadata?: Record<string, unknown> };

function operationsPage(
  items: CompanyBankAccountFixture[] = [accounts[0]],
  view: 'archived' | 'current' | 'pending' | 'remediation' = 'current',
  summaryOverrides: Record<string, unknown> = {},
) {
  return {
    generatedAt: '2026-08-11T10:42:00.000Z',
    items,
    pagination: { skip: 0, take: 25, totalCount: items.length },
    summary: {
      productionCount: items.filter((account) => account.dataScope === 'PRODUCTION').length,
      syntheticCount: 0,
      unknownDataScopeCount: 0,
      lastRecordedStatementImport: { account: accounts[0], importedAt: '2026-08-11T10:31:00.000Z' },
      oldestPendingRequestedAt: null,
      pendingApprovalCount: 0,
      reconciliationHealth: 'HEALTHY',
      unmatchedCount: 0,
      usableRealAccountCount: 1,
      ...summaryOverrides,
    },
    view,
  };
}

const auditLogs = [
  {
    action: 'company_bank_account.update',
    actor: { fullName: 'Current Operator', id: 'operator-current' },
    createdAt: '2026-07-15T08:00:00.000Z',
    id: 'audit-bank-1',
    metadata: {
      before: { name: 'Operations VND' },
      operatorReason: 'Archive after treasury review',
      proposed: { name: 'Operations reserve VND' },
      requestId: 'request-audit-1',
    },
    target: 'company_bank_account:bank-account-1',
  },
];

describe('CompanyBankAccountsPage', () => {
  beforeEach(() => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['SYSTEM_AUDIT', 'SYSTEM_POLICY'],
      id: 'operator-current',
      roles: ['ADMIN'],
    } as never);
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage(), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return { data: { items: auditLogs, skip: 0, take: 20, totalCount: 86 }, ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      if (href.includes('/status-preflight?')) {
        return { data: {
          accountId: 'bank-account-1',
          archiveImpact: {
            ready: true,
            sources: [{ coverage: 'COMPLETE', openCount: 0, source: 'BANK_TRANSACTIONS', totalCount: 4 }],
          },
          blockers: [], duplicateCandidate: null, eligibleApproverCount: 2,
          generatedAt: '2026-08-11T10:42:00.000Z',
          impact: { incompleteImportBatchCount: 0, lastOpenActivityAt: null, openTransactionCount: 0, scheduledReferenceCount: null, totalTransactionCount: 4 },
          mode: 'ARCHIVE', preflightHash: 'preflight-hash', ready: true, replacementAccount: null, replacementCandidates: [],
          statementImportEvidence: null,
        }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });
  });

  it('lists company bank accounts from the bounded admin API using the shared finance table shell', async () => {
    const page = await CompanyBankAccountsPage({});
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/company-bank-accounts/operations-page?view=current&skip=0&take=25',
      expect.objectContaining({ items: [], pagination: { skip: 0, take: 25, totalCount: 0 } }),
    );
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/company-bank-accounts/recent-changes?take=20',
      { accountSnapshots: [], items: [], skip: 0, take: 20, totalCount: 0 },
    );
    expect(markup).toContain('Company bank accounts');
    expect(markup).toContain('Current production accounts');
    expect(markup).toContain('Operations VND');
    expect(markup).not.toContain('Dormant settlement account');
    expect(markup).toContain('VCB');
    expect(markup).toContain('****0001');
    expect(markup).toContain('pill pill-success');
    expect(markup).toContain('Verified');
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('vuexy-booking-table');
    expect(markup).toContain('class="admin-form-control-link button button-outline"');
    expect(markup).toContain('Edit account');
    expect(markup).toContain('Review archive');
    expect(markup).not.toContain('Actions for Operations VND');
    expect(markup).not.toContain('#bank-account-1');
    expect(markup).not.toContain('<a class="button button-outline"');
    expect(markup).not.toContain('class="form-input"');
  });

  it('shows an operational health strip without repeating raw status totals', async () => {
    const page = await CompanyBankAccountsPage({});
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Usable production accounts');
    expect(markup).toContain('Pending approval');
    expect(markup).toContain('Import &amp; reconciliation');
    expect(markup).toContain('Last statement import');
    expect(markup).toContain('1 records in this view');
    expect(markup).not.toContain('Inactive accounts are retained');
  });

  it('uses a reviewed create flow that stores only masked account identity', async () => {
    const page = await CompanyBankAccountsPage({ searchParams: Promise.resolve({ dialog: 'new' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Add company bank account');
    expect(markup).toContain('Review and submit');
    expect(markup).toContain('Submit for approval');
    expect(markup).toContain(`value="company-bank-account-create"`);
    expect(markup).not.toContain('name="accountNumberMasked"');
    expect(markup).toContain('name="accountNumberLast4"');
    expect(markup).toContain('pattern="[0-9]{4}"');
    expect(markup).toContain('Stored mask preview:');
    expect(markup).toContain('Enter exactly four digits to preview the stored mask.');
    expect(markup).toContain('Full account numbers are not accepted or stored.');
    expect(markup).toContain('name="legalOwnerName"');
    expect(markup).toContain('Verification boundary');
    expect(markup).not.toContain('name="evidenceObjectId"');
    expect(markup).not.toContain('name="verificationStatus"');
    expect(markup).toContain('company-bank-account-drawer-footer');
    expect(requestFormSource).toContain('useActionState');
    expect(requestFormSource).toContain('CompanyBankAccountRequestReceipt');
    expect(requestFormSource).toContain('disabled={pending}');
    expect(markup).not.toContain('name="approvalAdminId"');
    expect(markup).not.toContain('name="accountNumber"');
    expect(mockedAdminGetResult).not.toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
  });

  it('edits controlled operational fields while keeping bank identity immutable', async () => {
    const page = await CompanyBankAccountsPage({
      searchParams: Promise.resolve({ accountId: 'bank-account-1', dialog: 'edit' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Edit company bank account');
    expect(markup).toContain('Submit for approval');
    expect(markup).toContain('name="confirmationAccountId" value="bank-account-1"');
    expect(markup).toContain('name="name"');
    expect(markup).not.toContain('name="bankName"');
    expect(markup).toContain('Immutable bank identity');
  });

  it('reviews archive and activation as status changes without exposing delete', async () => {
    const page = await CompanyBankAccountsPage({
      searchParams: Promise.resolve({
        accountId: 'bank-account-1',
        confirm: 'status',
        nextStatus: 'INACTIVE',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Request archive for Operations VND?');
    expect(markup).toContain('Submit archive request');
    expect(markup).toContain('Separate approvers');
    expect(markup).toContain('Preflight checks passed');
    expect(markup).toContain('Reference coverage');
    expect(markup).toContain('Bank transactions');
    expect(markup).toContain('COMPLETE');
    expect(markup).toContain('4 linked');
    expect(markup).not.toContain('NaN linked');
    expect(markup).toContain('Status change evidence');
    expect(source).toContain("adminPatchOrThrow<AdminCompanyBankAccount>(`/admin/company-bank-accounts/${encodeURIComponent(accountId)}`");
    expect(statusDialogSource).toContain('useActionState');
    expect(statusDialogSource).toContain("state.status === 'error'");
    expect(source).not.toContain('adminDelete');
    expect(source).not.toContain("method: 'DELETE'");
  });

  it('shows a persisted pending proposal with server-principal approve and reject actions', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage([
          {
            ...accounts[0],
            lifecycleStatus: 'PENDING_CHANGE',
            metadata: {
              pendingApproval: {
                operation: 'UPDATE',
                requestedByAdminId: 'operator-maker',
                requestId: 'request-1',
              },
            },
          },
        ]), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return { data: { items: auditLogs, skip: 0, take: 20, totalCount: 86 }, ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({}));

    expect(markup).toContain('Pending approval');
    expect(markup).toContain('Pending change');
    expect(markup).toContain('Review exact request');
    expect(markup).toContain('/finance-tax/approval-queue?view=bank-accounts#approval-request-1');
    expect(markup).not.toContain('Approve pending change');
    expect(markup).not.toContain('Reject pending change');
    expect(source).not.toContain('/approval-decision');
    expect(source).not.toContain("readFormString(formData, 'approvalAdminId')");
  });

  it('shows only a bounded recent account audit trail with operator evidence', async () => {
    const page = await CompanyBankAccountsPage({});
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Recent account changes');
    expect(markup).toContain('filtered by the account target before the 20-event limit');
    expect(markup).toContain('Showing 1 of 86 changes · 1 request lifecycle');
    expect(markup).toContain('Current Operator');
    expect(markup).toContain('Archive after treasury review');
    expect(markup).toContain('Request request-…');
    expect(markup).not.toContain('request-audit-1');
    expect(markup).toContain('/audit-log?range=all&amp;targetPrefix=company_bank_account%3A');
    expect(source).toContain("'/admin/company-bank-accounts/recent-changes?take=20'");
    expect(source).not.toContain('q=company_bank_account');
  });

  it('groups maker and checker events from the same request into one lifecycle row', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage(), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return {
          data: {
            items: [
              {
                ...auditLogs[0],
                action: 'company_bank_account.update',
                actor: { fullName: 'Finance Checker', id: 'operator-checker' },
                createdAt: '2026-07-15T08:05:00.000Z',
                id: 'audit-bank-2',
                metadata: {
                  after: { name: 'Operations reserve VND' },
                  before: { name: 'Operations VND' },
                  decision: 'APPROVE',
                  operatorReason: 'Evidence verified',
                  requestId: 'request-audit-1',
                },
              },
              {
                ...auditLogs[0],
                action: 'company_bank_account.approval_requested',
              },
            ],
            skip: 0,
            take: 20,
            totalCount: 2,
          },
          ok: true,
          status: 200,
        } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({}));

    expect(markup).toContain('Showing 2 of 2 changes · 1 request lifecycle');
    expect(markup).toContain('Approved');
    expect(markup).toContain('Maker');
    expect(markup).toContain('Current Operator');
    expect(markup).toContain('Checker');
    expect(markup).toContain('Finance Checker');
    expect(markup.match(/Request request-…/g)).toHaveLength(1);
    expect(markup).toContain('Operations reserve VND');
  });

  it('does not present permission failure as an empty account list', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: fallback,
      ok: false,
      status: href.startsWith('/admin/company-bank-accounts/operations-page?') ? 403 : 503,
    } as never));

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({}));

    expect(markup).toContain('Company bank account access denied');
    expect(markup).toContain('This is not an empty account list.');
    expect(markup).not.toContain('No company bank accounts were returned');
  });

  it('distinguishes a filtered empty result from an empty account inventory', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage([]), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return { data: { items: [], skip: 0, take: 20, totalCount: 0 }, ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({
      searchParams: Promise.resolve({ purpose: 'PAYOUT', verification: 'FAILED' }),
    }));

    expect(markup).toContain('No company bank accounts match the active filters.');
    expect(markup).toContain('Reset filters to review the full record set.');
    expect(markup).not.toContain('No current company bank accounts are registered.');
  });

  it('keeps account rows visible when only the timeline fails', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage(), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 1, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: false, requestId: 'request-timeline-1', status: 503 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({}));

    expect(markup).toContain('Operations VND');
    expect(markup).toContain('Account timeline could not be loaded');
    expect(markup).toContain('request-timeline-1');
    expect(markup).not.toContain('No recent company bank account changes were returned');
  });

  it('blocks change entry when no separate Finance approver exists', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage(), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return { data: { items: [], skip: 0, take: 20, totalCount: 0 }, ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 0, ready: false }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({
      searchParams: Promise.resolve({ dialog: 'new' }),
    }));

    expect(markup).toContain('No separate Finance approver is available');
    expect(markup).toContain('Review Finance approvers');
    expect(markup).not.toContain('Submit for approval');
  });

  it('maps actionable activation blockers to existing exact workflows', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return { data: operationsPage(), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return { data: { items: [], skip: 0, take: 20, totalCount: 0 }, ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      if (href.includes('/status-preflight?')) {
        return {
          data: {
            accountId: 'bank-account-1',
            archiveImpact: { ready: false, sources: [] },
            blockers: [
              { code: 'LEGAL_OWNER_MISSING', label: 'Legal account owner is missing' },
              { code: 'STATEMENT_IMPORT_TEST_MISSING', label: 'No successful statement import is linked' },
              { code: 'POTENTIAL_DUPLICATE', label: 'A potential duplicate account needs review' },
              { code: 'APPROVER_UNAVAILABLE', label: 'No separate Finance approver is available' },
              { code: 'OPEN_RECONCILIATION_REFERENCES', label: 'One open transaction remains' },
            ],
            duplicateCandidate: {
              accountNumberMasked: '****0002',
              bankName: 'Vietcombank',
              dataScope: 'UNKNOWN',
              id: 'bank-account-duplicate',
              name: 'Duplicate candidate',
            },
            eligibleApproverCount: 0,
            generatedAt: '2026-08-14T04:00:00.000Z',
            impact: {
              incompleteImportBatchCount: 0,
              lastOpenActivityAt: null,
              openTransactionCount: 1,
              scheduledReferenceCount: null,
              totalTransactionCount: 1,
            },
            mode: 'ACTIVATE',
            preflightHash: 'activation-preflight-hash',
            ready: false,
            replacementAccount: null,
            replacementCandidates: [],
            statementImportEvidence: null,
          },
          ok: true,
          status: 200,
        } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({
      searchParams: Promise.resolve({
        accountId: 'bank-account-1',
        confirm: 'status',
        nextStatus: 'ACTIVE',
        view: 'current',
      }),
    }));

    expect(markup).toContain('href="/finance-tax/company-bank-accounts?view=current&amp;dialog=edit&amp;accountId=bank-account-1"');
    expect(markup).toContain('href="/finance-tax/bank-reconciliation?workspace=imports"');
    expect(markup).toContain('href="/finance-tax/company-bank-accounts?view=remediation&amp;dialog=edit&amp;accountId=bank-account-duplicate"');
    expect(markup).toContain('href="/finance-tax/finance-approvers"');
    expect(markup).toContain('href="/finance-tax/bank-reconciliation?range=all&amp;review=unmatched"');
  });

  it('keeps archived records in a separate server-backed view', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?view=archived')) {
        return { data: operationsPage([accounts[1]], 'archived'), ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/recent-changes?take=20') {
        return { data: { items: [], skip: 0, take: 20, totalCount: 0 }, ok: true, status: 200 } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({
      searchParams: Promise.resolve({ view: 'archived' }),
    }));

    expect(markup).toContain('Archived account history');
    expect(markup).toContain('Dormant settlement account');
    expect(markup).toContain('Never activated');
    expect(markup).not.toContain('Operations VND');
  });

  it('separates unclassified legacy records into the remediation server view', async () => {
    const remediationAccount = {
      ...accounts[1],
      dataScope: 'UNKNOWN',
      lifecycleStatus: 'UNKNOWN_DATA_SCOPE',
    } as CompanyBankAccountFixture;
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?view=remediation')) {
        return {
          data: operationsPage([remediationAccount], 'remediation', {
            productionCount: 0,
            unknownDataScopeCount: 1,
            usableRealAccountCount: 0,
          }),
          ok: true,
          status: 200,
        } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({
      searchParams: Promise.resolve({ view: 'remediation' }),
    }));

    expect(markup).toContain('Account data remediation');
    expect(markup).toContain('Unclassified');
    expect(markup).toContain('Operational readiness: NOT READY');
    expect(mockedAdminGetResult).toHaveBeenCalledWith(
      '/admin/company-bank-accounts/operations-page?view=remediation&amp;skip=0&amp;take=25'.replaceAll('&amp;', '&'),
      expect.objectContaining({ view: 'remediation' }),
    );
  });

  it('shows an attention readiness state when production evidence exists but work remains', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/company-bank-accounts/operations-page?')) {
        return {
          data: operationsPage([accounts[0]], 'current', {
            pendingApprovalCount: 2,
            unknownDataScopeCount: 3,
            unmatchedCount: 4,
          }),
          ok: true,
          status: 200,
        } as never;
      }
      if (href === '/admin/company-bank-accounts/approver-readiness') {
        return { data: { eligibleApproverCount: 2, ready: true }, ok: true, status: 200 } as never;
      }
      return { data: fallback, ok: true, status: 200 } as never;
    });

    const markup = renderToStaticMarkup(await CompanyBankAccountsPage({}));

    expect(markup).toContain('Operational readiness: ATTENTION');
    expect(markup).toContain('4 open reconciliation items, 2 pending approvals, and 3 remediation records');
    expect(markup).toContain('value="PENDING_ACTIVATION"');
    expect(markup).toContain('value="ARCHIVED_WITH_HISTORY"');
    expect(markup).toContain('value="UNKNOWN_DATA_SCOPE"');
  });
});

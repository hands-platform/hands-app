import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import BankReconciliationPage from './page';

vi.mock('next/navigation', async () => {
  const actual = await vi.importActual<typeof import('next/navigation')>('next/navigation');
  return { ...actual, useRouter: () => ({ refresh: vi.fn() }) };
});

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');

  return {
    ...actual,
    adminGet: vi.fn(),
  };
});

vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);
const source = readFileSync(join(__dirname, 'page.tsx'), 'utf8');
const batchSource = readFileSync(join(__dirname, 'bank-statement-batch-import.tsx'), 'utf8');
const globalCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');

describe('BankReconciliationPage', () => {
  beforeEach(() => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({
      categories: ['FINANCE_BANK_RECONCILIATION'],
      email: 'owner@example.com',
      fullName: 'Reconciliation Owner',
      id: 'owner-1',
      phone: null,
      roles: ['ADMIN'],
      updatedAt: null,
    });
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/summary?range=today&review=unmatched') {
        return {
          amount: 0,
          count: 0,
          currency: 'VND',
          matchedCount: 0,
          unmatchedCount: 0,
        };
      }
      if (href === '/admin/bank-reconciliation?range=today&take=10&review=unmatched') {
        return [];
      }
      if (href === '/admin/company-bank-accounts?status=ACTIVE') {
        return [
          {
            accountNumberMasked: '****0001',
            bankName: 'VCB',
            currency: 'VND',
            id: 'bank-account-1',
            name: 'Operations VND',
            status: 'ACTIVE',
          },
        ];
      }
      return fallback;
    });
  });

  it('uses the shared Vuexy text link atom for bank transaction navigation', () => {
    expect(source).toContain("import { AdminTextLink } from '../../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
  });

  it('keeps the bank reconciliation list compact by avoiding duplicated page-template metrics', () => {
    expect(source).toContain('<FinanceListCommandBoard ariaLabel="Bank command board">');
    expect(source).not.toContain('metrics={[');
  });

  it('keeps review assignment separate from reconciliation state-changing actions', () => {
    expect(source).toContain('<ConfirmDialog');
    expect(source).toContain("'Reassign owner'");
    expect(source).toContain("'Assign owner'");
    expect(source).toContain('assignBankTransactionReviewAction');
    expect(source).toContain('/review-assignment`');
    expect(source).toContain('Review owner assigned. The bank transaction remains open');
    expect(source).toContain("'Review owner'");
    expect(source).toContain('transaction.reviewAssignment');
    expect(source).toContain('<AdminInlineFallback>Unassigned</AdminInlineFallback>');
    expect(source).toContain('withdrawalCandidateSummary?.reviewAssignment');
    expect(source).toContain('reason.length < 12');
  });

  it('confirms list review reassignment while preserving queue scope and excluding the current owner', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation?range=30d&take=10&review=outflow&candidate=eligible') {
        return [
          {
            _count: { reconciliationMatches: 0 },
            amount: 500000,
            bankAccountId: 'bank-account-1',
            createdAt: '2026-07-15T03:00:00.000Z',
            currency: 'VND',
            id: 'bank-review-target',
            occurredAt: '2026-07-15T03:00:00.000Z',
            sourceKey: 'bank-outflow:review-target',
            status: 'UNMATCHED',
            type: 'OUTFLOW',
            updatedAt: '2026-07-15T03:00:00.000Z',
            withdrawalCandidateSummary: {
              candidateCount: 2,
              confidence: 'REVIEW',
              reviewAssignment: {
                assignedAt: '2026-07-15T04:00:00.000Z',
                assignedByAdminId: 'maker-1',
                assigneeAdminId: 'owner-2',
                reason: 'Initial evidence review assignment',
              },
              reviewCount: 2,
              slaStatus: 'CURRENT',
              strongCount: 0,
              waitingHours: 4,
            },
          },
        ];
      }
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-1',
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
            email: 'current@example.com',
            fullName: 'Current Operator',
            id: 'owner-1',
            roles: ['ADMIN'],
          },
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-2',
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
            email: 'assigned@example.com',
            fullName: 'Assigned Operator',
            id: 'owner-2',
            roles: ['ADMIN'],
          },
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-3',
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
            email: 'alternate@example.com',
            fullName: 'Alternate Operator',
            id: 'owner-3',
            roles: ['ADMIN'],
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        bankTransactionId: 'bank-review-target',
        candidate: 'eligible',
        confirm: 'review-owner',
        range: '30d',
        review: 'outflow',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Reassign bank reconciliation review?');
    expect(markup).toContain('Assignment reason');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('<option value="owner-1" selected="">Current Operator · current@example.com</option>');
    expect(markup).not.toContain('<option value="owner-2">');
    expect(markup).toContain('<option value="owner-3">Alternate Operator · alternate@example.com</option>');
    expect(markup).toContain('href="/finance-tax/bank-reconciliation?range=30d&amp;review=outflow&amp;candidate=eligible"');
    expect(markup).toContain('confirm=review-owner&amp;bankTransactionId=bank-review-target');
    expect(markup).not.toContain('>Assign review</summary>');
  });

  it('requires an explicit operator review before overriding potential duplicate import protection', () => {
    expect(source).toContain('Potential duplicate review');
    expect(source).toContain('confirmPotentialDuplicate');
    expect(source).toContain("error.status === 409 ? 'duplicate' : 'failed'");
    expect(source).toContain('Review the existing transaction list first');
    expect(source).toContain('Potential duplicate bank transactions');
    expect(source).toContain('potentialDuplicateCandidateIds(error)');
    expect(source).toContain('bankDuplicateCandidates');
    expect(source).toContain('Review {shortId(candidateId)}');
  });

  it('adds a two-step CSV review flow without saving during preview', () => {
    expect(source).toContain("import { BankStatementBatchImport } from './bank-statement-batch-import';");
    expect(source).toContain('CSV bank statement review');
    expect(batchSource).toContain('Preview statement');
    expect(batchSource).toContain('Preview never');
    expect(batchSource).toContain('saves data and is limited to 50 rows');
    expect(batchSource).toContain('Review bank statement batch import');
    expect(batchSource).toContain('Confirm import of ${selectedRows.size} row(s)');
    expect(batchSource).toContain('name="batchOperatorReason"');
    expect(batchSource).toContain('operatorReason: operatorReason.trim()');
    expect(batchSource).toContain('operatorReason.trim().length < 12');
    expect(batchSource).toContain('BankReconciliationConfirmationDisclosure');
    expect(batchSource).toContain('POTENTIAL_DUPLICATE');
    expect(batchSource).toContain('EXACT_DUPLICATE');
    expect(batchSource).toContain('CSV mapping');
    expect(batchSource).toContain('Download template');
    expect(batchSource).toContain('bankStatementCsvTemplate(preset)');
    expect(batchSource).toContain('Download issue report');
    expect(batchSource).toContain('bankStatementCsvIssueReport(preview.rows)');
    expect(batchSource).toContain('Download retry file');
    expect(batchSource).toContain("row.classification !== 'EXACT_DUPLICATE'");
    expect(batchSource).toContain("crypto.subtle.digest('SHA-256'");
    expect(batchSource).toContain('sourceFileName: file.name');
    expect(batchSource).toContain('sourceFileSha256');
    expect(batchSource).toContain('mappingPreset: preset');
    expect(batchSource).toContain('Batch ID:');
    expect(source).toContain('Bank statement import history');
    expect(source).toContain('/admin/bank-reconciliation/import-batches?${search.toString()}');
    expect(source).toContain('File contents are not retained.');
    expect(source).toContain('SHA-256');
    expect(source).toContain('Bank statement import history pages');
    expect(source).toContain('Statement import history filters');
    expect(source).toContain('Search import history');
    expect(source).toContain('Import date range');
    expect(source).toContain('Reconciliation queue');
    expect(source).toContain('Needs reconciliation');
    expect(source).toContain('importHistoryReviewValue');
    expect(source).toContain('buildImportHistoryApiHref');
    expect(source).toContain('Date range and reconciliation queue are applied on the server.');
    expect(source).toContain('reconciliationNeedsActionCount');
    expect(source).toContain('reconciliationProgressPercent');
    expect(source).toContain('need action');
    expect(source).toContain('buildFinanceApproverOptions(adminUsers, currentOperatorId)');
    expect(source).toContain('financeApproverOptions={financeApproverOptions}');
    expect(batchSource).toContain('label="Separate Finance approver"');
    expect(batchSource).not.toContain('Approving admin ID');
  });

  it('shows batch reconciliation priority before opening the batch detail', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/bank-reconciliation/import-batches?')) {
        return {
          items: [
            {
              approvalAdminId: 'approver-1',
              approver: { email: 'approver@example.com', fullName: 'Finance Approver', id: 'approver-1' },
              assignee: null,
              assigneeAdminId: null,
              assignedAt: null,
              assignedByAdminId: null,
              batchImportId: 'batch-priority-1',
              createdAt: '2026-07-14T02:00:00.000Z',
              importedCount: 2,
              mappingPreset: 'VCB',
              operator: { email: 'maker@example.com', fullName: 'Finance Maker', id: 'maker-1' },
              reconciliationNeedsActionCount: 1,
              reconciliationProgressPercent: 50,
              reconciliationSlaStatus: 'ESCALATE',
              reconciliationTransactionCount: 2,
              reconciliationWaitingHours: 54,
              reconciledTransactionCount: 1,
              requestedCount: 2,
              skippedCount: 0,
              sourceFileName: 'VCB-July.csv',
              sourceFileSha256: 'a'.repeat(64),
            },
          ],
          pagination: { skip: 0, take: 10, total: 1 },
        };
      }
      return fallback;
    });

    const page = await BankReconciliationPage({ searchParams: Promise.resolve({ range: 'today' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Escalate');
    expect(markup).toContain('1 open');
    expect(markup).toContain('54h waiting');
    expect(markup).toContain('Import owner');
    expect(markup).toContain('Unassigned');
    expect(markup).toContain('Assign owner');
    expect(markup).toContain('confirm=batch-owner&amp;batchImportId=batch-priority-1');
    expect(markup).not.toContain('Assignment reason');
    expect(markup).toContain('50% complete');
    expect(markup).toContain('1/2');
    expect(markup).toContain('/finance-tax/bank-reconciliation/import-batches/batch-priority-1');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
  });

  it('confirms import batch reassignment while preserving list scope and excluding the current owner', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/import-batches?range=30d&skip=10&take=10&q=VCB&review=stale') {
        return {
          items: [
            {
              approvalAdminId: 'approver-1',
              approver: { email: 'approver@example.com', fullName: 'Finance Approver', id: 'approver-1' },
              assignee: { email: 'assigned@example.com', fullName: 'Assigned Operator', id: 'owner-2' },
              assigneeAdminId: 'owner-2',
              assignedAt: '2026-07-15T03:00:00.000Z',
              assignedByAdminId: 'maker-1',
              batchImportId: 'batch-priority-1',
              createdAt: '2026-07-14T02:00:00.000Z',
              importedCount: 2,
              mappingPreset: 'VCB',
              operator: { email: 'maker@example.com', fullName: 'Finance Maker', id: 'maker-1' },
              reconciliationNeedsActionCount: 1,
              reconciliationProgressPercent: 50,
              reconciliationSlaStatus: 'ESCALATE',
              reconciliationTransactionCount: 2,
              reconciliationWaitingHours: 54,
              reconciledTransactionCount: 1,
              requestedCount: 2,
              skippedCount: 0,
              sourceFileName: 'VCB-July.csv',
              sourceFileSha256: 'a'.repeat(64),
            },
          ],
          pagination: { skip: 10, take: 10, total: 20 },
        };
      }
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-1',
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
            email: 'current@example.com',
            fullName: 'Current Operator',
            id: 'owner-1',
            roles: ['ADMIN'],
          },
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-2',
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
            email: 'assigned@example.com',
            fullName: 'Assigned Operator',
            id: 'owner-2',
            roles: ['ADMIN'],
          },
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-3',
              updatedAt: '2026-07-15T00:00:00.000Z',
            },
            email: 'alternate@example.com',
            fullName: 'Alternate Operator',
            id: 'owner-3',
            roles: ['ADMIN'],
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        batchImportId: 'batch-priority-1',
        candidate: 'eligible',
        confirm: 'batch-owner',
        importPage: '2',
        importQ: 'VCB',
        importRange: '30d',
        importReview: 'stale',
        range: '30d',
        review: 'outflow',
      }),
    });
    const markup = renderToStaticMarkup(page);
    const cleanReturnHref = '/finance-tax/bank-reconciliation?range=30d&amp;review=outflow&amp;candidate=eligible&amp;importQ=VCB&amp;importRange=30d&amp;importReview=stale&amp;importPage=2';

    expect(markup).toContain('Reassign bank statement batch review?');
    expect(markup).toContain('VCB-July.csv has 1 open transaction(s)');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('<option value="owner-1" selected="">Current Operator · current@example.com</option>');
    expect(markup).not.toContain('<option value="owner-2">');
    expect(markup).toContain('<option value="owner-3">Alternate Operator · alternate@example.com</option>');
    expect(markup).toContain(`href="${cleanReturnHref}"`);
    expect(markup).toContain(`type="hidden" name="redirectTo" value="${cleanReturnHref}"`);
    expect(markup).not.toContain('confirm=batch-owner"');
    expect(markup).not.toContain('batchImportId=batch-priority-1&amp;candidate=eligible');
  });

  it('passes the import reconciliation queue to the paginated history API', async () => {
    await BankReconciliationPage({
      searchParams: Promise.resolve({
        importQ: 'VCB',
        importRange: '30d',
        importReview: 'needs-reconciliation',
        range: 'today',
      }),
    });

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/import-batches?range=30d&skip=0&take=10&q=VCB&review=needs-reconciliation',
      { items: [], pagination: { skip: 0, take: 10, total: 0 } },
    );
  });

  it('applies a visible transfer-reference search to both transaction rows and summary totals', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        q: 'VCB-OUT-120',
        range: '30d',
        review: 'unmatched',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=30d&review=unmatched&q=VCB-OUT-120',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&q=VCB-OUT-120',
      [],
    );
    expect(markup).toContain('Search bank transactions');
    expect(markup).toContain('value="VCB-OUT-120"');
    expect(markup).toContain('Search: VCB-OUT-120.');
    expect(markup).toContain('range=30d&amp;review=matched&amp;q=VCB-OUT-120');
    expect(markup).toContain('>Clear</a>');
  });

  it('applies withdrawal candidate priority to rows, summary totals, links, and pagination', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        candidate: 'strong',
        page: '2',
        q: 'VCB-OUT-120',
        range: '30d',
        review: 'unmatched',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=30d&review=unmatched&q=VCB-OUT-120&candidate=strong',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&skip=10&q=VCB-OUT-120&candidate=strong',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/withdrawal-candidate-summary?range=30d&q=VCB-OUT-120',
      expect.any(Object),
    );
    expect(markup).toContain('Withdrawal candidates: Strong candidates. Review owner: All owners.');
    expect(markup).toContain('Oldest candidate transactions appear first.');
    expect(markup).toContain('Strong candidates');
    expect(markup).toContain('Needs review');
    expect(markup).toContain('No candidate');
    expect(markup).toContain('candidate=review');
    expect(markup).toContain('candidate=strong');
    expect(markup).toContain('q=VCB-OUT-120');
    expect(markup).toContain('review=matched&amp;q=VCB-OUT-120');
    expect(markup).not.toContain('review=matched&amp;q=VCB-OUT-120&amp;candidate=strong');
  });

  it('filters candidate reviews by the current operator without exposing the operator id in page links', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        candidate: 'eligible',
        owner: 'mine',
        range: '30d',
        review: 'outflow',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=30d&review=outflow&candidate=eligible&assignment=assigned&assigneeAdminId=owner-1',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=outflow&candidate=eligible&assignment=assigned&assigneeAdminId=owner-1',
      [],
    );
    expect(markup).toContain('Review owner: My reviews.');
    expect(markup).toContain('Review ownership');
    expect(markup).toContain('My assigned reviews');
    expect(markup).toContain('owner=unassigned');
    expect(markup).not.toContain('assigneeAdminId=owner-1');
  });

  it('renders review owner identities from the summary while loading only the bounded approver directory', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/withdrawal-candidate-summary?range=30d') {
        return {
          assignedCount: 1,
          assignments: [
            {
              assignee: {
                email: 'summary-owner@example.com',
                fullName: 'Summary Owner',
                id: 'summary-owner-1',
              },
              assigneeAdminId: 'summary-owner-1',
              count: 2,
              over24hCount: 1,
              over48hCount: 0,
            },
          ],
          currency: 'VND',
          eligibleCount: 2,
          noneAmount: 0,
          noneCount: 0,
          oldestReviewOccurredAt: null,
          oldestStrongOccurredAt: null,
          reviewAmount: 0,
          reviewCount: 0,
          reviewOver24hCount: 0,
          reviewOver48hCount: 0,
          strongAmount: 0,
          strongCount: 0,
          strongOver24hCount: 0,
          strongOver48hCount: 0,
          unassignedCount: 1,
        };
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: '30d', review: 'unmatched' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Summary Owner');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
  });

  it('shows outflow withdrawal candidate priority before opening transaction detail', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/summary?range=30d&review=outflow') {
        return {
          amount: 1200000,
          count: 2,
          currency: 'VND',
          matchedCount: 0,
          unmatchedCount: 2,
        };
      }
      if (href === '/admin/bank-reconciliation/withdrawal-candidate-summary?range=30d') {
        return {
          assignedCount: 3,
          assignments: [
            {
              assigneeAdminId: 'owner-1',
              count: 2,
              over24hCount: 1,
              over48hCount: 1,
            },
            {
              assigneeAdminId: 'owner-2',
              count: 1,
              over24hCount: 0,
              over48hCount: 0,
            },
          ],
          currency: 'VND',
          eligibleCount: 5,
          noneAmount: 200000,
          noneCount: 2,
          oldestReviewOccurredAt: '2026-07-14T02:00:00.000Z',
          oldestStrongOccurredAt: '2026-07-12T02:00:00.000Z',
          reviewAmount: 700000,
          reviewCount: 1,
          reviewOver24hCount: 1,
          reviewOver48hCount: 0,
          strongAmount: 1200000,
          strongCount: 2,
          strongOver24hCount: 2,
          strongOver48hCount: 1,
          unassignedCount: 2,
        };
      }
      if (href === '/admin/bank-reconciliation?range=30d&take=10&review=outflow') {
        return [
          {
            _count: { reconciliationMatches: 0 },
            amount: 500000,
            bankAccount: {
              bankName: 'VCB',
              currency: 'VND',
              id: 'bank-account-1',
              name: 'Operations VND',
              status: 'ACTIVE',
            },
            bankAccountId: 'bank-account-1',
            counterpartyName: 'Smoke Partner',
            currency: 'VND',
            id: 'bank-outflow-strong',
            occurredAt: '2026-07-15T03:00:00.000Z',
            sourceKey: 'bank-outflow:strong',
            status: 'UNMATCHED',
            transferRef: 'VCB-OUT-500',
            type: 'OUTFLOW',
            withdrawalCandidateSummary: {
              candidateCount: 3,
              confidence: 'STRONG',
              reviewCount: 2,
              slaStatus: 'OVER_48H',
              strongCount: 1,
              waitingHours: 72,
            },
          },
          {
            _count: { reconciliationMatches: 0 },
            amount: 700000,
            bankAccountId: 'bank-account-1',
            currency: 'VND',
            id: 'bank-outflow-none',
            occurredAt: '2026-07-15T04:00:00.000Z',
            sourceKey: 'bank-outflow:none',
            status: 'UNMATCHED',
            type: 'OUTFLOW',
            withdrawalCandidateSummary: {
              candidateCount: 0,
              confidence: 'NONE',
              reviewCount: 0,
              slaStatus: 'OVER_24H',
              strongCount: 0,
              waitingHours: 26,
            },
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: '30d', review: 'outflow' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Strong withdrawal candidate');
    expect(markup).toContain('3 withdrawal candidate(s) · 1 strong');
    expect(markup).toContain('No withdrawal candidate');
    expect(markup).toContain('0 withdrawal candidate(s)');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-outflow-strong');
    expect(markup).toContain('Strong withdrawal candidates');
    expect(markup).toContain('Withdrawal candidates to review');
    expect(markup).toContain('Over 48h');
    expect(markup).toContain('Over 24h');
    expect(markup).toContain('Oldest candidate:');
    expect(markup).toContain('72h waiting · 48h+');
    expect(markup).toContain('26h waiting · 24h+');
    expect(markup).toContain('1.200.000 VND');
    expect(markup).toContain('700.000 VND');
    expect(markup).toContain('review=outflow&amp;candidate=strong');
    expect(markup).toContain('review=outflow&amp;candidate=review');
  });

  it('shows an all-date import batch work card linked to the open queue', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/import-batches/summary') {
        return {
          batchCount: 5,
          escalatedNeedsReconciliationCount: 1,
          needsReconciliationCount: 2,
          noTransactionCount: 1,
          oldestOpenImportedAt: '2026-07-01T00:00:00.000Z',
          reconciledCount: 2,
          staleNeedsReconciliationCount: 1,
        };
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: 'today', review: 'unmatched' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Import batches');
    expect(markup).toContain('2 statement import batch(es) contain open bank transactions.');
    expect(markup).toContain('1 over 24 hours.');
    expect(markup).toContain('1 over 48 hours.');
    expect(markup).toContain('Over 48h');
    expect(markup).toContain(
      '/finance-tax/bank-reconciliation?range=today&amp;review=unmatched&amp;importRange=all&amp;importReview=escalated',
    );
    expect(markup).not.toContain('Match status');
  });

  it('keeps manual import bounded and shows validation failures without overlapping raw inputs', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ bankImportError: 'invalid', range: 'today' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank transaction import failed');
    expect(markup).toContain('finance-reconciliation-import-disclosure');
    expect(markup).toContain('Bank import form');
    expect(markup).toContain('Bank account');
    expect(markup).toContain('Operations VND - VCB - ****0001 - VND');
    expect(markup).toContain('<details class="admin-disclosure finance-reconciliation-import-disclosure" open="">');
    expect(markup).not.toContain(
      '<details class="card admin-card admin-disclosure finance-reconciliation-import-disclosure" open="">',
    );
    expect(markup).toContain('card admin-filter-panel admin-mb-16');
    expect(markup).toContain('Active finance list filters');
    expect(markup).toContain('Range: Today');
    expect(markup).toContain('Queue: Unmatched');
    expect(markup).toContain('Rows: 10');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-textarea');
    expect(markup).not.toContain('class="form-input"');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=today&review=unmatched',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=today&take=10&review=unmatched',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/company-bank-accounts?status=ACTIVE', []);
  });

  it('keeps the manual import form collapsed during normal unmatched review', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: 'today', review: 'unmatched' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('finance-reconciliation-import-disclosure');
    expect(markup).toContain('Bank import form');
    expect(markup).not.toContain('<details class="admin-disclosure finance-reconciliation-import-disclosure" open="">');
  });

  it('scopes reconciliation disclosure and match heading typography to direct slots', () => {
    expect(globalCss).toContain('.finance-reconciliation-import-disclosure > summary > span');
    expect(globalCss).toContain('.finance-reconciliation-import-disclosure > summary > small');
    expect(globalCss).toContain('.finance-reconciliation-match-heading > div > strong');
    expect(globalCss).toContain('.finance-reconciliation-match-heading > div > span:not(.pill)');

    expect(globalCss).not.toContain('.finance-reconciliation-import-disclosure > summary span {');
    expect(globalCss).not.toContain('.finance-reconciliation-import-disclosure > summary small {');
    expect(globalCss).not.toContain('.finance-reconciliation-match-heading strong {');
    expect(globalCss).not.toContain('.finance-reconciliation-match-heading span:not(.pill),');
  });
});

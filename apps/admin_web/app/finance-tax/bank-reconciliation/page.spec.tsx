import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import BankReconciliationPage, { generateMetadata } from './page';

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
const selectionSource = readFileSync(join(__dirname, 'bank-reconciliation-selection-summary.tsx'), 'utf8');
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
      if (href === '/admin/bank-reconciliation?range=all&take=10&review=unmatched') {
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

  it('remounts only the Bank filter form when its URL-owned values change', () => {
    expect(source).toContain('key={JSON.stringify([');
    expect(source).toContain('transactionQuery,');
    expect(source).toContain('bankTransactionDirection,');
    expect(source).toContain('withdrawalCandidate,');
    expect(source).toContain('reviewOwner,');
  });

  it('uses a Bank-only two-column search form without changing Payment Clearing filters', () => {
    expect(source).toContain('className="filter-form admin-mb-12 bank-reconciliation-search-form"');
    expect(globalCss).toMatch(
      /\.finance-matching-operations-filter \.bank-reconciliation-search-form\s*{\s*grid-template-columns: minmax\(0, 1fr\) auto;/,
    );
    expect(globalCss).toMatch(
      /\.finance-matching-operations-filter \.bank-reconciliation-search-form > \.admin-form-action-row\s*{\s*align-self: end;\s*grid-column: auto;/,
    );
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

  it('connects bank transactions to the four-part payment matching workspace', () => {
    expect(source).toContain('ariaLabel="Payment matching workspace"');
    expect(source).toContain('paymentMatchingTabLabel(');
    expect(source).toContain("'Bank transactions',");
    expect(source).toContain("'Unmatched payment evidence',");
    expect(source).toContain("'Partial matches',");
    expect(source).toContain("'Cleared & reversed history',");
  });

  it('uses workspace-specific document titles for bank operations', async () => {
    await expect(generateMetadata({ searchParams: Promise.resolve({}) })).resolves.toEqual({
      title: 'Bank Transactions',
    });
    await expect(generateMetadata({ searchParams: Promise.resolve({ workspace: 'imports' }) })).resolves.toEqual({
      title: 'Bank Statement Imports',
    });
    await expect(generateMetadata({ searchParams: Promise.resolve({ workspace: 'manual' }) })).resolves.toEqual({
      title: 'Manual Bank Entry',
    });
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

  it('supports bounded bulk review assignment from unresolved queues without changing reconciliation state', () => {
    expect(source).toContain('assignBankTransactionReviewsAction');
    expect(source).toContain('adminPostOrThrow<BankReviewAssignmentResult>');
    expect(source).toContain("'/admin/bank-reconciliation/review-assignments'");
    expect(source).toContain(".getAll('bankTransactionIds')");
    expect(source).toContain('bankTransactionIds.length > 50');
    expect(selectionSource).toContain('Assign selected');
    expect(source).toContain('name="bankTransactionIds"');
    expect(selectionSource).toContain('Closed or changed records are rejected');
    expect(source).toContain('bankReconciliationReviewNeedsOwner(filters.review)');
  });

  it('renders selection controls without loading owner options until the operator selects work', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation?range=all&take=10&review=unmatched') {
        return [
          {
            _count: { reconciliationMatches: 0 },
            amount: 250000,
            bankAccountId: 'bank-account-1',
            createdAt: '2026-07-20T03:00:00.000Z',
            currency: 'VND',
            id: 'bank-bulk-target',
            occurredAt: '2026-07-20T03:00:00.000Z',
            sourceKey: 'bank-inflow:bulk-target',
            status: 'UNMATCHED',
            type: 'INFLOW',
            updatedAt: '2026-07-20T03:00:00.000Z',
          },
        ];
      }
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [
          {
            adminOperatorPermission: {
              categories: ['FINANCE_BANK_RECONCILIATION'],
              id: 'permission-1',
              updatedAt: '2026-07-20T00:00:00.000Z',
            },
            email: 'owner@example.com',
            fullName: 'Reconciliation Owner',
            id: 'owner-1',
            roles: ['ADMIN'],
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationPage({});
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Select all visible');
    expect(markup).toContain('0 selected');
    expect(markup).not.toContain('Assign selected to');
    expect(markup).toContain('name="bankTransactionIds"');
    expect(markup).toContain('value="bank-bulk-target"');
    expect(markup).toContain('data-bank-selection-amount="250000"');
    expect(markup).toContain('data-has-selection="false"');
    expect(markup).not.toContain('finance-bank-bulk-controls');
    expect(selectionSource).toContain('loadOwnerOptionsRef.current()');
    expect(selectionSource).toContain('const shouldSelect = summary.count === 0');
    expect(selectionSource).toContain('disabled={!canSubmit}');
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
  });

  it('confirms list review reassignment while preserving queue scope and excluding the current owner', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href ===
        '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&type=OUTFLOW&candidate=eligible'
      ) {
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
        review: 'unmatched',
        type: 'OUTFLOW',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Reassign bank reconciliation review?');
    expect(markup).toContain('Assignment reason');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain(
      '<option value="" selected="">Select an eligible Finance operator</option>',
    );
    expect(markup).toContain('<option value="owner-1">Current Operator · current@example.com</option>');
    expect(markup).not.toContain('<option value="owner-2">');
    expect(markup).toContain('<option value="owner-3">Alternate Operator · alternate@example.com</option>');
    expect(markup).toContain(
      'href="/finance-tax/bank-reconciliation?range=30d&amp;review=unmatched&amp;type=OUTFLOW&amp;candidate=eligible"',
    );
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
    expect(batchSource).toContain('Statement import preview facts');
    expect(batchSource).toContain('<dt>Account</dt>');
    expect(batchSource).toContain('<dt>Currency</dt>');
    expect(batchSource).toContain('<dt>Statement period</dt>');
    expect(batchSource).toContain('<dt>Upload file</dt>');
    expect(batchSource).toContain('<dt>Statement rows</dt>');
    expect(batchSource).toContain('<dt>Total parsed amount</dt>');
    expect(batchSource).toContain('<dt>Duplicate candidates</dt>');
    expect(batchSource).toContain('<dt>Parsing errors</dt>');
    expect(batchSource).toContain('<dt>Expected creations</dt>');
    expect(batchSource).toContain('<dt>File fingerprint</dt>');
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
    expect(source).not.toContain('buildFinanceApproverOptions(adminUsers, currentOperatorId)');
    expect(source).not.toContain('financeApproverOptions={financeApproverOptions}');
    expect(batchSource).not.toContain('label="Separate Finance approver"');
    expect(batchSource).not.toContain('approvalAdminId');
    expect(batchSource).toContain('signed-in importing operator');
    expect(source).toContain('Required at reconciliation');
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

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: 'today', workspace: 'imports' }),
    });
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
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
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
        review: 'unmatched',
        workspace: 'imports',
      }),
    });
    const markup = renderToStaticMarkup(page);
    const cleanReturnHref =
      '/finance-tax/bank-reconciliation?workspace=imports&amp;range=30d&amp;review=unmatched&amp;importQ=VCB&amp;importRange=30d&amp;importReview=stale&amp;importPage=2';

    expect(markup).toContain('Reassign bank statement batch review?');
    expect(markup).toContain('VCB-July.csv has 1 open transaction(s)');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain(
      '<option value="" selected="">Select an eligible Finance operator</option>',
    );
    expect(markup).toContain('<option value="owner-1">Current Operator · current@example.com</option>');
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

  it('filters list and summary by linked evidence source and renders the retained source', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href ===
          '/admin/bank-reconciliation/summary?range=30d&review=matched&type=INFLOW&source=PAYMENT_CLEARING' ||
        href === '/admin/bank-reconciliation/summary?range=30d&type=INFLOW&source=PAYMENT_CLEARING'
      ) {
        return {
          amount: 240000,
          assignedCount: 0,
          count: 1,
          currency: 'VND',
          ignoredCount: 0,
          matchedAmount: 240000,
          matchedCount: 1,
          partiallyMatchedAmount: 0,
          partiallyMatchedCount: 0,
          reversedCount: 0,
          unassignedCount: 0,
          unmatchedAmount: 0,
          unmatchedCount: 0,
        };
      }
      if (
        href ===
        '/admin/bank-reconciliation?range=30d&take=10&review=matched&type=INFLOW&source=PAYMENT_CLEARING'
      ) {
        return [
          {
            _count: { reconciliationMatches: 1 },
            amount: 240000,
            bankAccount: {
              accountNumberLast4: '0001',
              accountNumberMasked: '****0001',
              bankName: 'VCB',
              currency: 'VND',
              id: 'bank-account-1',
              name: 'Operations VND',
            },
            bankAccountId: 'bank-account-1',
            counterpartyName: 'MoMo Clearing',
            currency: 'VND',
            description: 'Daily payment clearing settlement',
            id: 'bank-clearing-1',
            occurredAt: '2026-07-20T03:00:00.000Z',
            reconciliationMatchedAmount: 240000,
            reconciliationRemainingAmount: 0,
            reconciliationSources: ['PAYMENT_CLEARING'],
            sourceKey: 'bank-clearing-source-1',
            status: 'MATCHED',
            transferRef: 'VCB-CLEARING-1',
            type: 'INFLOW',
            valueDate: null,
          },
        ];
      }
      if (
        href === '/admin/bank-reconciliation/evidence-source-summary?range=30d&review=matched&type=INFLOW'
      ) {
        return {
          amount: 740000,
          count: 3,
          currency: 'VND',
          sources: [
            { amount: 240000, count: 1, source: 'PAYMENT_CLEARING' },
            { amount: 0, count: 0, source: 'PARTNER_DEPOSIT' },
            { amount: 0, count: 0, source: 'WITHDRAWAL' },
            { amount: 0, count: 0, source: 'PAYOUT' },
            { amount: 0, count: 0, source: 'REFUND' },
            { amount: 0, count: 0, source: 'OTHER_JOURNAL' },
            { amount: 500000, count: 2, source: 'UNCLASSIFIED' },
          ],
        };
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        range: '30d',
        review: 'matched',
        source: 'payment-clearing',
        type: 'INFLOW',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=30d&review=matched&type=INFLOW&source=PAYMENT_CLEARING',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=matched&type=INFLOW&source=PAYMENT_CLEARING',
      [],
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/evidence-source-summary?range=30d&review=matched&type=INFLOW',
      expect.any(Object),
    );
    expect(markup).toContain('Evidence source: Payment clearing.');
    expect(markup).toContain(
      'Evidence totals use active matches; one transaction may appear in more than one linked source.',
    );
    expect(markup).toContain('value="PAYMENT_CLEARING"');
    expect(markup).toContain('Payment clearing · 1 · 240.000 VND');
    expect(markup).toContain('Not linked · 2 · 500.000 VND');
    expect(markup).toContain('source=UNCLASSIFIED');
    expect(markup).toContain('<th scope="col">Evidence</th>');
    expect(markup).not.toContain('Withdrawal evidence');
  });

  it('keeps period overview metrics stable while the transaction queue is filtered', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/summary?range=30d&review=matched&q=VCB-MATCHED') {
        return {
          amount: 200000,
          assignedCount: 0,
          count: 1,
          currency: 'VND',
          ignoredCount: 0,
          matchedAmount: 200000,
          matchedCount: 1,
          partiallyMatchedAmount: 0,
          partiallyMatchedCount: 0,
          reversedCount: 0,
          unassignedCount: 0,
          unmatchedAmount: 0,
          unmatchedCount: 0,
        };
      }
      if (href === '/admin/bank-reconciliation/summary?range=all') {
        return {
          amount: 2000000,
          assignedCount: 2,
          count: 10,
          currency: 'VND',
          ignoredCount: 0,
          matchedAmount: 1200000,
          matchedCount: 6,
          openExposureAmount: 800000,
          oldestPartiallyMatchedAt: '2026-07-15T02:00:00.000Z',
          oldestUnassignedAt: '2026-07-14T02:00:00.000Z',
          partiallyMatchedAmount: 300000,
          partiallyMatchedCount: 1,
          reversedCount: 0,
          unassignedCount: 1,
          unassignedOver48hAmount: 300000,
          unassignedOver48hCount: 1,
          unmatchedAmount: 500000,
          unmatchedCount: 3,
        };
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        q: 'VCB-MATCHED',
        range: '30d',
        review: 'matched',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Open exposure');
    expect(markup).toContain('800.000 VND');
    expect(markup).toContain('4 open bank transaction(s) still have an unmatched remainder.');
    expect(markup).toContain('48h+ unassigned');
    expect(markup).toContain('1 total unassigned review(s); 300.000 VND has waited at least 48 hours.');
    expect(markup).toContain('review=unmatched&amp;age=48h&amp;owner=unassigned');
    expect(markup).toContain('Resolved rate');
    expect(markup).toContain('Resolved rate: </span>60%');
    expect(markup).toContain('Matched records');
  });

  it('applies and exposes the 48h age filter consistently across the unresolved queue', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        age: '48h',
        range: '30d',
        review: 'unmatched',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=30d&review=unmatched&age=48h',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/evidence-source-summary?range=30d&review=unmatched&age=48h',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&age=48h',
      [],
    );
    expect(markup).toContain('Waiting age: 48h+ waiting.');
    expect(markup).toContain('48h+ waiting');
    expect(markup).toContain('All ages');
    expect(markup).toContain('review=unmatched');
  });

  it('ignores withdrawal candidate filters outside the dedicated outflow queue', async () => {
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
      '/admin/bank-reconciliation/summary?range=30d&review=unmatched&q=VCB-OUT-120',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&skip=10&q=VCB-OUT-120',
      [],
    );
    expect(markup).toContain('Queue: Needs action. Review owner: All owners.');
    expect(markup).not.toContain('Withdrawal candidates:');
    expect(markup).not.toContain('candidate=review');
    expect(markup).not.toContain('candidate=strong');
    expect(markup).toContain('q=VCB-OUT-120');
    expect(markup).toContain('review=matched&amp;q=VCB-OUT-120');
  });

  it('filters candidate reviews by the current operator without exposing the operator id in page links', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        candidate: 'eligible',
        owner: 'mine',
        range: '30d',
        review: 'unmatched',
        type: 'OUTFLOW',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=30d&review=unmatched&type=OUTFLOW&candidate=eligible&assignment=assigned&assigneeAdminId=owner-1',
      expect.any(Object),
    );
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&type=OUTFLOW&candidate=eligible&assignment=assigned&assigneeAdminId=owner-1',
      [],
    );
    expect(markup).toContain('Review owner: My reviews.');
    expect(markup).toContain('Needs action · Outflow');
    expect(markup).toContain('My reviews');
    expect(markup).toContain('owner=unassigned');
    expect(markup).not.toContain('Review ownership');
    expect(markup).not.toContain('assigneeAdminId=owner-1');
  });

  it('shows all-owner unresolved workload without loading the approver directory before assignment', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (
        href ===
        '/admin/bank-reconciliation/review-owner-summary?range=30d&review=unmatched&type=OUTFLOW&q=VCB-OUT&candidate=review'
      ) {
        return {
          currency: 'VND',
          openAmount: 1200000,
          openCount: 4,
          owners: [
            {
              assignee: {
                email: 'owner@example.com',
                fullName: 'Reconciliation Owner',
                id: 'owner-1',
              },
              assigneeAdminId: 'owner-1',
              oldestOccurredAt: '2026-07-14T02:00:00.000Z',
              openAmount: 700000,
              openCount: 2,
              over48hAmount: 200000,
              over48hCount: 1,
            },
            {
              assignee: {
                email: 'second@example.com',
                fullName: 'Second Reviewer',
                id: 'owner-2',
              },
              assigneeAdminId: 'owner-2',
              oldestOccurredAt: '2026-07-15T02:00:00.000Z',
              openAmount: 200000,
              openCount: 1,
              over48hAmount: 0,
              over48hCount: 0,
            },
          ],
          unassigned: {
            oldestOccurredAt: '2026-07-13T02:00:00.000Z',
            openAmount: 300000,
            openCount: 1,
            over48hAmount: 300000,
            over48hCount: 1,
          },
        };
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        candidate: 'review',
        owner: 'mine',
        q: 'VCB-OUT',
        range: '30d',
        review: 'unmatched',
        type: 'OUTFLOW',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/review-owner-summary?range=30d&review=unmatched&type=OUTFLOW&q=VCB-OUT&candidate=review',
      expect.any(Object),
    );
    expect(mockedAdminGet.mock.calls.map(([href]) => href)).not.toContain(
      '/admin/bank-reconciliation/withdrawal-candidate-summary?range=30d',
    );
    expect(mockedAdminGet).not.toHaveBeenCalledWith(
      '/admin/users?take=50&role=ADMIN&view=finance-approver-directory',
      [],
    );
    expect(markup).toContain('Review owner workload');
    expect(markup).toContain('4 open reviews');
    expect(markup).toContain('Reconciliation Owner');
    expect(markup).toContain('Second Reviewer');
    expect(markup).toContain('Needs an owner');
    expect(markup).toContain('owner=unassigned');
    expect(markup).toContain('owner=mine');
    expect(markup).not.toContain('assigneeAdminId=owner-2');
  });

  it('shows outflow withdrawal candidate priority before opening transaction detail', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T03:00:00.000Z'));
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/summary?range=30d&review=unmatched&type=OUTFLOW') {
        return {
          amount: 1200000,
          assignedCount: 0,
          count: 2,
          currency: 'VND',
          ignoredCount: 0,
          matchedAmount: 0,
          matchedCount: 0,
          partiallyMatchedAmount: 0,
          partiallyMatchedCount: 0,
          reversedCount: 0,
          unassignedCount: 2,
          unmatchedAmount: 1200000,
          unmatchedCount: 2,
        };
      }
      if (href === '/admin/bank-reconciliation?range=30d&take=10&review=unmatched&type=OUTFLOW') {
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
            occurredAt: '2026-07-17T01:00:00.000Z',
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
      searchParams: Promise.resolve({ range: '30d', review: 'unmatched', type: 'OUTFLOW' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Strong withdrawal candidate');
    expect(markup).toContain('3 withdrawal candidate(s) · 1 strong');
    expect(markup).toContain('No withdrawal candidate');
    expect(markup).toContain('0 withdrawal candidate(s)');
    expect(markup).toContain('/finance-tax/bank-reconciliation/bank-outflow-strong');
    expect(markup).toContain('3d waiting · 48h+');
    expect(markup).toContain('1d 2h waiting · 24h+');
    expect(markup).toContain('review=unmatched&amp;type=OUTFLOW&amp;candidate=strong');
    expect(markup).toContain('review=unmatched&amp;type=OUTFLOW&amp;candidate=review');
    expect(markup).not.toContain('Oldest candidate:');
    vi.useRealTimers();
  });

  it('shows one common review SLA for unresolved rows without withdrawal candidates', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-18T03:00:00.000Z'));
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/bank-reconciliation/summary?range=30d&review=partial&type=INFLOW') {
        return {
          amount: 250000,
          assignedCount: 0,
          count: 1,
          currency: 'VND',
          ignoredCount: 0,
          matchedAmount: 0,
          matchedCount: 0,
          partiallyMatchedAmount: 250000,
          partiallyMatchedCount: 1,
          reversedCount: 0,
          unassignedCount: 0,
          unassignedOver48hAmount: 0,
          unassignedOver48hCount: 0,
          unmatchedAmount: 0,
          unmatchedCount: 0,
        };
      }
      if (href === '/admin/bank-reconciliation?range=30d&take=10&review=partial&type=INFLOW') {
        return [
          {
            _count: { reconciliationMatches: 1 },
            amount: 250000,
            bankAccountId: 'bank-account-1',
            currency: 'VND',
            id: 'bank-inflow-partial',
            occurredAt: '2026-07-16T02:00:00.000Z',
            reconciliationMatchedAmount: 100000,
            reconciliationRemainingAmount: 150000,
            sourceKey: 'bank-inflow:partial',
            status: 'PARTIALLY_MATCHED',
            type: 'INFLOW',
          },
        ];
      }
      return fallback;
    });

    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({
        range: '30d',
        review: 'partial',
        type: 'INFLOW',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('2d 1h waiting · 48h+');
    expect(markup).toContain('Unassigned');
    expect(markup).not.toContain('withdrawal candidate(s)');
    vi.useRealTimers();
  });

  it('keeps statement import separate from the live review queue', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: 'today', review: 'unmatched' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank transactions');
    expect(markup).toContain('Statement imports');
    expect(markup).toContain('/finance-tax/bank-reconciliation?workspace=imports');
    expect(markup).toContain('Bank reconciliation filters');
    expect(markup).toContain('Needs action');
    expect(markup).not.toContain('CSV bank statement review');
    expect(markup).not.toContain('Bank statement import history');
    expect(markup).not.toContain('Manual bank transaction import');
  });

  it('keeps manual import bounded and shows validation failures without overlapping raw inputs', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ bankImportError: 'invalid', range: 'today', workspace: 'manual' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Bank transaction import failed');
    expect(markup).toContain('finance-reconciliation-import-disclosure');
    expect(markup).toContain('Bank import form');
    expect(markup).toContain('Bank account');
    expect(markup).toContain('Operations VND - VCB - ****0001 - VND');
    expect(markup).toContain(
      '<details class="admin-disclosure finance-reconciliation-import-disclosure" open="">',
    );
    expect(markup).not.toContain(
      '<details class="card admin-card admin-disclosure finance-reconciliation-import-disclosure" open="">',
    );
    expect(markup).toContain('Payment Matching');
    expect(markup).toContain('Statement imports');
    expect(markup).not.toContain('Bank reconciliation filters');
    expect(markup).not.toContain('CSV bank statement review');
    expect(markup).not.toContain('Bank statement import history');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-textarea');
    expect(markup).not.toContain('class="form-input"');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/company-bank-accounts?status=ACTIVE', []);
  });

  it('keeps the manual import form collapsed during normal unmatched review', async () => {
    const page = await BankReconciliationPage({
      searchParams: Promise.resolve({ range: 'today', review: 'unmatched', workspace: 'manual' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('finance-reconciliation-import-disclosure');
    expect(markup).toContain('Bank import form');
    expect(markup).not.toContain(
      '<details class="admin-disclosure finance-reconciliation-import-disclosure" open="">',
    );
  });

  it('loads only the APIs required by the selected reconciliation task', async () => {
    await BankReconciliationPage({ searchParams: Promise.resolve({ range: 'today' }) });
    const operationsHrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(operationsHrefs).toContain('/admin/bank-reconciliation/summary?range=today&review=unmatched');
    expect(operationsHrefs).toContain('/admin/bank-reconciliation/summary?range=all');
    expect(operationsHrefs).toContain(
      '/admin/bank-reconciliation/review-owner-summary?range=today&review=unmatched',
    );
    expect(operationsHrefs).toContain('/admin/bank-reconciliation?range=today&take=10&review=unmatched');
    expect(operationsHrefs).not.toContain('/admin/bank-reconciliation/import-batches/summary');
    expect(operationsHrefs.some((href) => href.includes('withdrawal-candidate-summary'))).toBe(false);
    expect(operationsHrefs).not.toContain('/admin/company-bank-accounts?status=ACTIVE');
    expect(operationsHrefs).not.toContain('/admin/users?take=50&role=ADMIN&view=finance-approver-directory');
    expect(operationsHrefs).not.toContain(
      '/admin/bank-reconciliation/import-batches?range=today&skip=0&take=10',
    );

    mockedAdminGet.mockClear();
    await BankReconciliationPage({ searchParams: Promise.resolve({ workspace: 'imports' }) });
    const importHrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(importHrefs).toContain('/admin/company-bank-accounts?status=ACTIVE');
    expect(importHrefs).not.toContain('/admin/users?take=50&role=ADMIN&view=finance-approver-directory');
    expect(importHrefs).toContain('/admin/bank-reconciliation/import-batches?range=today&skip=0&take=10');
    expect(importHrefs).not.toContain('/admin/bank-reconciliation/import-batches/summary');
    expect(importHrefs).not.toContain('/admin/bank-reconciliation/summary?range=today&review=unmatched');
    expect(importHrefs).not.toContain(
      '/admin/bank-reconciliation/review-owner-summary?range=today&review=unmatched',
    );
    expect(importHrefs).not.toContain('/admin/bank-reconciliation?range=today&take=10&review=unmatched');

    mockedAdminGet.mockClear();
    await BankReconciliationPage({ searchParams: Promise.resolve({ workspace: 'manual' }) });
    const manualHrefs = mockedAdminGet.mock.calls.map(([href]) => href);

    expect(manualHrefs).not.toContain('/admin/bank-reconciliation/summary?range=today&review=unmatched');
    expect(manualHrefs).not.toContain('/admin/bank-reconciliation/summary?range=today');
    expect(manualHrefs).not.toContain(
      '/admin/bank-reconciliation/review-owner-summary?range=today&review=unmatched',
    );
    expect(manualHrefs).not.toContain('/admin/bank-reconciliation?range=today&take=10&review=unmatched');
    expect(manualHrefs).not.toContain('/admin/bank-reconciliation/import-batches?range=today&skip=0&take=10');
    expect(manualHrefs).toContain('/admin/company-bank-accounts?status=ACTIVE');
    expect(manualHrefs).not.toContain('/admin/users?take=50&role=ADMIN&view=finance-approver-directory');
  });

  it('does not load review-owner workload for closed reconciliation records', async () => {
    await BankReconciliationPage({
      searchParams: Promise.resolve({ range: '30d', review: 'matched' }),
    });

    expect(
      mockedAdminGet.mock.calls.some(([href]) => href.includes('/bank-reconciliation/review-owner-summary')),
    ).toBe(false);
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

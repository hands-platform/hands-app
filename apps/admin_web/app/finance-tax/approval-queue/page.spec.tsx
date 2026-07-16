import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';

import { adminGet } from '../../../lib/admin-api';
import { getCurrentAdminOperatorAccess } from '../../../lib/admin-operator-access';
import FinanceApprovalQueuePage from './page';

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return { ...actual, adminGet: vi.fn() };
});
vi.mock('../../../lib/admin-operator-access', () => ({
  getCurrentAdminOperatorAccess: vi.fn(),
}));

const mockedAdminGet = vi.mocked(adminGet);
const mockedGetCurrentAdminOperatorAccess = vi.mocked(getCurrentAdminOperatorAccess);

describe('FinanceApprovalQueuePage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue(null);
  });

  it('shows persisted policy, withdrawal, and wallet approval work separately from completed evidence', async () => {
    mockedAdminGet.mockResolvedValue({
      generatedAt: '2026-07-13T09:00:00.000Z',
      limit: 25,
      summary: {
        paymentFeePolicyPendingCount: 1,
        withdrawalOpenCount: 3,
        withdrawalRequestedCount: 2,
        withdrawalReviewRequiredCount: 1,
        withdrawalBankTransferPendingCount: 1,
        withdrawalOpenAmount: 900000,
        withdrawalCurrency: 'VND',
        walletAdjustmentLast7dCount: 4,
        walletAdjustmentPendingCount: 1,
        partnerBankDepositPendingCount: 1,
        partnerBankDepositLast7dCount: 2,
      },
      paymentFeePolicyRequests: [
        {
          requestId: 'approval-1',
          policyId: 'policy-1',
          policyName: 'Gateway fees 2026',
          effectiveFrom: '2026-08-01T00:00:00.000Z',
          policyUpdatedAt: '2026-07-13T08:00:00.000Z',
          reason: 'Independent contract review',
          requestedAt: '2026-07-13T08:30:00.000Z',
          requestedBy: {
            id: 'maker-admin',
            email: 'maker@example.test',
            fullName: 'Policy Maker',
          },
        },
      ],
      withdrawalRequests: [
        {
          id: 'withdrawal-1',
          providerProfileId: 'provider-1',
          partnerName: 'Partner One',
          amount: 400000,
          currency: 'VND',
          status: 'REQUESTED',
          hasBankAccount: false,
          createdAt: '2026-07-13T07:00:00.000Z',
          updatedAt: '2026-07-13T07:00:00.000Z',
        },
      ],
      walletAdjustmentRequests: [
        {
          id: 'wallet-request-1',
          ownerType: 'PARTNER',
          ownerId: 'provider-1',
          ownerName: 'Partner One',
          direction: 'CREDIT',
          adjustmentType: 'PARTNER_BONUS',
          amount: 200000,
          currency: 'VND',
          reason: 'Recovery bonus',
          monthlyPeriod: '2026-07',
          attachmentUrl: null,
          requestedBeforeBalance: 0,
          requestedAfterBalance: 200000,
          requiresAttachment: false,
          requestedByAdminId: 'wallet-maker',
          requestedBy: { id: 'wallet-maker', fullName: 'Wallet Maker' },
          createdAt: '2026-07-13T08:45:00.000Z',
        },
      ],
      walletAdjustmentEvidence: {
        last7dCount: 4,
        pendingQueueSupported: true,
      },
      partnerBankDepositRequests: [
        {
          id: 'deposit-request-1',
          providerProfileId: 'provider-1',
          partnerName: 'Partner One',
          amount: 1000000,
          currency: 'VND',
          bankTransactionId: 'BIDV-20260713-001',
          depositDate: '2026-07-13T08:00:00.000Z',
          bankAccount: 'BIDV settlement account',
          attachmentFileId: 'evidence-1',
          attachmentUrl: null,
          notes: 'Bank statement confirmed',
          requestedBeforeBalance: -170000,
          requestedAfterBalance: 830000,
          requestedReceivableRecovery: 170000,
          requestedWalletLiabilityIncrease: 830000,
          createdAt: '2026-07-13T08:40:00.000Z',
          requestedBy: { id: 'deposit-maker', fullName: 'Deposit Maker' },
        },
      ],
    });

    const page = await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ take: '25' }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Finance Approval Queue');
    expect(markup).toContain('Payment fee policy reviews');
    expect(markup).toContain('Gateway fees 2026');
    expect(markup).toContain('Partner withdrawal work queue');
    expect(markup).toContain('Partner One');
    expect(markup).toContain('900.000 VND');
    expect(markup).toContain('Wallet adjustment approval queue');
    expect(markup).toContain('Approve &amp; execute');
    expect(markup).toContain('Recovery bonus');
    expect(markup).toContain('Wallet adjustment records');
    expect(markup).toContain('/wallet-adjustments?view=records');
    expect(markup).toContain('Partner bank deposit approval queue');
    expect(markup).toContain('BIDV-20260713-001');
    expect(markup).toContain('Receivable recovery');
    expect(markup).toContain('policyId=policy-1');
    expect(markup).toContain('withdrawalStatus=REQUESTED');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/finance-approval-queue?take=25', expect.any(Object));
  });

  it('defaults the queue to a bounded ten rows', async () => {
    await FinanceApprovalQueuePage({ searchParams: Promise.resolve({ take: '500' }) });

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/finance-approval-queue?take=10', expect.any(Object));
  });

  it('shows executed Partner deposits that still need bank reconciliation as a bounded post-approval queue', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/provider-wallet/deposit-requests/history?')) {
        return {
          items: [
            {
              id: 'deposit-executed-1',
              providerProfileId: 'provider-1',
              amount: 80000,
              currency: 'VND',
              bankTransactionId: 'SMOKE-CASH-FEE-001',
              status: 'EXECUTED',
              requestedByAdminId: 'maker-admin',
              requestedBeforeBalance: -80000,
              requestedAfterBalance: 0,
              requestedReceivableRecovery: 80000,
              requestedWalletLiabilityIncrease: 0,
              reconciliationMatchedAmount: 0,
              reconciliationRemainingAmount: 80000,
              reconciliationReviewAssignment: {
                assignedAt: '2026-07-14T09:00:00.000Z',
                assignedByAdminId: 'master-admin',
                assigneeAdminId: 'finance-operator-1',
                assignee: { id: 'finance-operator-1', fullName: 'Finance Operator' },
                reason: 'Own overdue deposit evidence',
              },
              reconciliationSlaStatus: 'OVER_24H',
              reconciliationWaitingHours: 27,
              reconciliationStatus: 'UNMATCHED',
              executedAt: '2026-07-14T08:00:00.000Z',
              createdAt: '2026-07-14T07:00:00.000Z',
              updatedAt: '2026-07-14T08:00:00.000Z',
              providerProfile: { id: 'provider-1', displayName: 'Partner Evidence' },
            },
          ],
          pagination: { skip: 0, take: 10, total: 1 },
          statusCounts: { EXECUTED: 1 },
          reconciliationSummary: { openAmount: 80000, openCount: 1, period: null },
        } as never;
      }
      return fallback as never;
    });

    const page = await FinanceApprovalQueuePage({ searchParams: Promise.resolve({ take: '10' }) });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Partner bank deposit reconciliation queue');
    expect(markup).toContain('Post-approval');
    expect(markup).toContain('Partner Evidence');
    expect(markup).toContain('SMOKE-CASH-FEE-001');
    expect(markup).toContain('80.000 VND');
    expect(markup).toContain('Over 24h · 27h');
    expect(markup).toContain('Finance Operator');
    expect(markup).toContain('Reassign owner');
    expect(markup).toContain('/finance-tax/partner-bank-deposits/deposit-executed-1');
    expect(markup).toContain('q=SMOKE-CASH-FEE-001');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/history?status=EXECUTED&review=needs-reconciliation&skip=0&take=10',
      expect.any(Object),
    );
  });

  it('assigns an open deposit reconciliation through an operator-scoped confirmation dialog', async () => {
    mockedGetCurrentAdminOperatorAccess.mockResolvedValue({ id: 'master-admin' } as never);
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href === '/admin/users?take=50&role=ADMIN&view=finance-approver-directory') {
        return [{
          id: 'finance-operator-1',
          email: 'operator@hands.test',
          phone: '',
          fullName: 'Finance Operator',
          roles: ['ADMIN'],
          adminOperatorPermission: {
            id: 'permission-1',
            categories: ['FINANCE_BANK_RECONCILIATION'],
            updatedAt: '2026-07-15T00:00:00.000Z',
          },
        }] as never;
      }
      if (href.startsWith('/admin/provider-wallet/deposit-requests/history?')) {
        return {
          items: [{
            id: 'deposit-executed-1',
            providerProfileId: 'provider-1',
            amount: 80000,
            currency: 'VND',
            bankTransactionId: 'SMOKE-CASH-FEE-001',
            status: 'EXECUTED',
            requestedByAdminId: 'maker-admin',
            requestedBeforeBalance: -80000,
            requestedAfterBalance: 0,
            requestedReceivableRecovery: 80000,
            requestedWalletLiabilityIncrease: 0,
            reconciliationRemainingAmount: 80000,
            reconciliationSlaStatus: 'ESCALATE',
            reconciliationWaitingHours: 52,
            executedAt: '2026-07-13T08:00:00.000Z',
            createdAt: '2026-07-13T07:00:00.000Z',
            updatedAt: '2026-07-13T08:00:00.000Z',
            providerProfile: { id: 'provider-1', displayName: 'Partner Evidence' },
          }],
          pagination: { skip: 0, take: 10, total: 1 },
          statusCounts: { EXECUTED: 1 },
          reconciliationSummary: { openAmount: 80000, openCount: 1, period: null },
        } as never;
      }
      return fallback as never;
    });

    const page = await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'assign-deposit-reconciliation',
        requestId: 'deposit-executed-1',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Assign Partner deposit reconciliation?');
    expect(markup).toContain('name="assigneeAdminId"');
    expect(markup).toContain('Finance Operator · operator@hands.test');
    expect(markup).toContain('minLength="12"');
    expect(markup).toContain('name="confirmationRequestId" value="deposit-executed-1"');
    expect(mockedGetCurrentAdminOperatorAccess).toHaveBeenCalledTimes(1);
  });

  it('moves wallet approval and deposit rejection into scoped confirmation dialogs', async () => {
    mockedAdminGet.mockResolvedValue({
      generatedAt: '2026-07-15T09:00:00.000Z',
      limit: 25,
      summary: {
        paymentFeePolicyPendingCount: 0,
        withdrawalOpenCount: 0,
        withdrawalRequestedCount: 0,
        withdrawalReviewRequiredCount: 0,
        withdrawalBankTransferPendingCount: 0,
        withdrawalOpenAmount: 0,
        withdrawalCurrency: 'VND',
        walletAdjustmentLast7dCount: 1,
        walletAdjustmentPendingCount: 1,
        partnerBankDepositPendingCount: 1,
        partnerBankDepositLast7dCount: 1,
      },
      paymentFeePolicyRequests: [],
      withdrawalRequests: [],
      walletAdjustmentRequests: [
        {
          id: 'wallet-request-1',
          ownerType: 'PARTNER',
          ownerId: 'provider-1',
          ownerName: 'Partner One',
          direction: 'CREDIT',
          adjustmentType: 'PARTNER_BONUS',
          amount: 200000,
          currency: 'VND',
          reason: 'Recovery bonus',
          monthlyPeriod: '2026-07',
          attachmentUrl: null,
          requestedBeforeBalance: 0,
          requestedAfterBalance: 200000,
          requiresAttachment: false,
          requestedByAdminId: 'wallet-maker',
          requestedBy: { id: 'wallet-maker', fullName: 'Wallet Maker' },
          createdAt: '2026-07-15T08:45:00.000Z',
        },
      ],
      walletAdjustmentEvidence: { last7dCount: 1, pendingQueueSupported: true },
      partnerBankDepositRequests: [
        {
          id: 'deposit-request-1',
          providerProfileId: 'provider-1',
          partnerName: 'Partner One',
          amount: 1000000,
          currency: 'VND',
          bankTransactionId: 'BIDV-20260715-001',
          depositDate: '2026-07-15T08:00:00.000Z',
          bankAccount: 'BIDV settlement account',
          attachmentFileId: 'evidence-1',
          attachmentUrl: null,
          notes: 'Bank statement confirmed',
          requestedBeforeBalance: -170000,
          requestedAfterBalance: 830000,
          requestedReceivableRecovery: 170000,
          requestedWalletLiabilityIncrease: 830000,
          createdAt: '2026-07-15T08:40:00.000Z',
          requestedBy: { id: 'deposit-maker', fullName: 'Deposit Maker' },
        },
      ],
    });

    const walletPage = await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'approve-wallet',
        requestId: 'wallet-request-1',
        take: '25',
      }),
    });
    const walletMarkup = renderToStaticMarkup(walletPage);

    expect(walletMarkup).toContain('Approve and execute wallet adjustment?');
    expect(walletMarkup).toContain('200.000 VND credit');
    expect(walletMarkup).toContain('name="confirmationRequestId" value="wallet-request-1"');
    expect(walletMarkup).toContain('href="/finance-tax/approval-queue?take=25"');
    expect(walletMarkup).toContain('confirm=reject-wallet&amp;requestId=wallet-request-1&amp;take=25');
    expect(walletMarkup).not.toContain('<form class="admin-form-shell"');

    const depositPage = await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'reject-deposit',
        requestId: 'deposit-request-1',
        take: '25',
      }),
    });
    const depositMarkup = renderToStaticMarkup(depositPage);

    expect(depositMarkup).toContain('Reject Partner bank deposit request?');
    expect(depositMarkup).toContain('without changing bank, wallet, cash, tax, or ledger balances');
    expect(depositMarkup).toContain('minLength="12"');
    expect(depositMarkup).toContain('/finance-tax/partner-bank-deposits/deposit-request-1');
  });
});

import { renderToStaticMarkup } from 'react-dom/server';
import { vi } from 'vitest';
import { redirect } from 'next/navigation';

import { adminGet, adminGetResult } from '../../../lib/admin-api';
import FinanceApprovalQueuePage from './page';

vi.mock('next/navigation', () => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`REDIRECT:${href}`);
  }),
}));

vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  const mockedAdminGet = vi.fn();
  return {
    ...actual,
    adminGet: mockedAdminGet,
    adminGetResult: vi.fn(async (href: string, fallback: unknown) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    })),
  };
});
const mockedAdminGet = vi.mocked(adminGet);
const mockedAdminGetResult = vi.mocked(adminGetResult);
const mockedRedirect = vi.mocked(redirect);

describe('FinanceApprovalQueuePage', () => {
  beforeEach(() => {
    mockedAdminGet.mockImplementation(async (_href, fallback) => fallback);
    mockedAdminGetResult.mockImplementation(async (href, fallback) => ({
      data: await mockedAdminGet(href, fallback),
      ok: true,
      status: 200,
    }));
    mockedRedirect.mockClear();
  });

  it('merges open finance work into an oldest-first priority queue without rendering every detailed table', async () => {
    mockedAdminGet.mockResolvedValue({
      generatedAt: '2026-07-13T09:00:00.000Z',
      limit: 25,
      summary: {
        paymentFeePolicyPendingCount: 1,
        companyBankAccountPendingCount: 1,
        withdrawalOpenCount: 3,
        withdrawalRequestedCount: 2,
        withdrawalReviewRequiredCount: 1,
        withdrawalBankTransferPendingCount: 1,
        withdrawalOpenAmount: 900000,
        withdrawalCurrency: 'VND',
        walletAdjustmentLast7dCount: 4,
        walletAdjustmentPendingCount: 1,
        walletAdjustmentReadyCount: 1,
        walletAdjustmentBlockedCount: 0,
        walletAdjustmentStaleCount: 0,
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
      companyBankAccountRequests: [
        {
          id: 'company-bank-account-1',
          name: 'Primary settlement',
          bankName: 'Vietcombank',
          accountNumberMasked: '•••• 4321',
          accountNumberLast4: '4321',
          currency: 'VND',
          status: 'ACTIVE',
          operation: 'UPDATE',
          operatorReason: 'Rotate the settlement account operating label',
          requestedAt: '2026-07-13T06:30:00.000Z',
          requestId: 'bank-account-request-1',
          requestedBy: {
            id: 'bank-account-maker',
            email: 'bank-maker@example.test',
            fullName: 'Bank Account Maker',
          },
          proposed: {
            name: 'Primary settlement account',
            bankName: 'Vietcombank',
            accountNumberMasked: '•••• 4321',
            accountNumberLast4: '4321',
            currency: 'VND',
            status: 'ACTIVE',
          },
          reviewState: 'READY',
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
          reviewState: 'READY',
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
    expect(markup).toContain('finance-list-command-board admin-mb-16 finance-approval-command-board');
    expect(markup).toContain('Other approvals');
    expect(markup).toContain('1 policies · 1 bank changes · 1 deposits');
    expect(markup).toContain('Withdrawal review');
    expect(markup).toContain('Payout approvals');
    expect(markup).toContain('Wallet adjustments');
    expect(markup).toContain('Post-approval bank matching');
    expect(markup).toContain('Ready decisions');
    expect(markup).toContain('Repair exceptions');
    expect(markup).toContain('Rows shown');
    expect(markup).toContain('7 total open');
    expect(markup).toContain('Primary settlement account');
    expect(markup).toContain('Gateway fees 2026');
    expect(markup).toContain('Partner One');
    expect(markup).toContain('Recovery bonus');
    expect(markup).toContain('BIDV-20260713-001');
    expect(markup).toContain('Bank account missing');
    expect(markup).toContain('Control blocked');
    expect(markup).toContain('Open evidence');
    const readyMarkup = markup.slice(markup.indexOf('Ready decisions'), markup.indexOf('Repair exceptions'));
    const repairMarkup = markup.slice(markup.indexOf('Repair exceptions'));
    expect(readyMarkup).toContain('Bank account');
    expect(readyMarkup).toContain('Fee policy');
    expect(readyMarkup).toContain('Wallet');
    expect(repairMarkup).toContain('Withdrawal');
    expect(repairMarkup).toContain('Bank deposit');
    expect(markup).not.toContain('Payment fee policy reviews');
    expect(markup).not.toContain('Partner withdrawal work queue');
    expect(markup).not.toContain('Wallet adjustment approval queue');
    expect(markup).not.toContain('Partner bank deposit approval queue');
    expect(markup).not.toContain('Partner bank deposit reconciliation queue');
    expect(markup).toContain('policyId=policy-1');
    expect(markup).toContain('withdrawalStatus=REQUESTED');
    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/finance-approval-queue?take=25&view=priority', expect.any(Object));
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=all&review=unmatched',
      expect.any(Object),
    );
  });

  it('renders only the selected approval work type in each focused queue', async () => {
    mockedAdminGet.mockResolvedValue({
      generatedAt: '2026-07-13T09:00:00.000Z',
      limit: 10,
      summary: {
        paymentFeePolicyPendingCount: 1,
        companyBankAccountPendingCount: 1,
        withdrawalOpenCount: 1,
        withdrawalRequestedCount: 1,
        withdrawalReviewRequiredCount: 0,
        withdrawalBankTransferPendingCount: 0,
        withdrawalOpenAmount: 400000,
        withdrawalCurrency: 'VND',
        walletAdjustmentLast7dCount: 1,
        walletAdjustmentPendingCount: 1,
        walletAdjustmentReadyCount: 1,
        walletAdjustmentBlockedCount: 0,
        walletAdjustmentStaleCount: 0,
        partnerBankDepositPendingCount: 1,
        partnerBankDepositLast7dCount: 1,
      },
      paymentFeePolicyRequests: [{
        requestId: 'approval-1',
        policyId: 'policy-1',
        policyName: 'Gateway fees 2026',
        effectiveFrom: '2026-08-01T00:00:00.000Z',
        policyUpdatedAt: '2026-07-13T08:00:00.000Z',
        requestedAt: '2026-07-13T08:30:00.000Z',
        requestedBy: { id: 'maker-admin' },
      }],
      companyBankAccountRequests: [{
        id: 'company-bank-account-1',
        name: 'Primary settlement',
        bankName: 'Vietcombank',
        accountNumberMasked: '•••• 4321',
        currency: 'VND',
        status: 'ACTIVE',
        operation: 'UPDATE',
        operatorReason: 'Rotate the settlement account operating label',
        requestedAt: '2026-07-13T06:30:00.000Z',
        requestId: 'bank-account-request-1',
        requestedBy: { id: 'bank-account-maker', fullName: 'Bank Account Maker' },
        proposed: {
          name: 'Primary settlement account',
          bankName: 'Vietcombank',
          accountNumberMasked: '•••• 4321',
          currency: 'VND',
          status: 'ACTIVE',
        },
        reviewState: 'READY',
      }],
      withdrawalRequests: [{
        id: 'withdrawal-1',
        providerProfileId: 'provider-1',
        partnerName: 'Partner One',
        amount: 400000,
        currency: 'VND',
        status: 'REQUESTED',
        hasBankAccount: true,
        createdAt: '2026-07-13T07:00:00.000Z',
        updatedAt: '2026-07-13T07:00:00.000Z',
      }],
      walletAdjustmentRequests: [{
        id: 'wallet-request-1',
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        currency: 'VND',
        reason: 'Recovery bonus',
        requestedBeforeBalance: 0,
        requestedAfterBalance: 200000,
        requiresAttachment: false,
        requestedByAdminId: 'wallet-maker',
        reviewState: 'READY',
        createdAt: '2026-07-13T08:45:00.000Z',
      }],
      walletAdjustmentEvidence: { last7dCount: 1, pendingQueueSupported: true },
      partnerBankDepositRequests: [{
        id: 'deposit-request-1',
        providerProfileId: 'provider-1',
        partnerName: 'Partner One',
        amount: 1000000,
        currency: 'VND',
        bankTransactionId: 'BIDV-20260713-001',
        depositDate: '2026-07-13T08:00:00.000Z',
        requestedBeforeBalance: 0,
        requestedAfterBalance: 1000000,
        requestedReceivableRecovery: 0,
        requestedWalletLiabilityIncrease: 1000000,
        createdAt: '2026-07-13T08:40:00.000Z',
        requestedBy: { id: 'deposit-maker' },
      }],
    });

    const policiesMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'policies' }),
    }));
    const depositsMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'deposits' }),
    }));
    const bankAccountsMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'bank-accounts' }),
    }));
    const bankAccountApprovalMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'approve-bank-account',
        requestId: 'bank-account-request-1',
        view: 'bank-accounts',
      }),
    }));
    const withdrawalsMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'withdrawals' }),
    }));
    const walletMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'wallet' }),
    }));

    expect(policiesMarkup).toContain('Payment fee policy reviews');
    expect(bankAccountsMarkup).toContain('Company bank account approval queue');
    expect(bankAccountsMarkup).toContain('Primary settlement account');
    expect(bankAccountsMarkup).toContain('Bank Account Maker');
    expect(bankAccountsMarkup).toContain('Approve change');
    expect(bankAccountsMarkup).toContain('Reject');
    expect(bankAccountsMarkup).not.toContain('Payment fee policy reviews');
    expect(bankAccountApprovalMarkup).toContain('Approve company bank account change?');
    expect(bankAccountApprovalMarkup).toContain('name="operatorReason"');
    expect(bankAccountApprovalMarkup).toContain('name="bankAccountId"');
    expect(bankAccountApprovalMarkup).not.toContain('name="approvalAdminId"');
    expect(policiesMarkup).not.toContain('Partner bank deposit approval queue');
    expect(depositsMarkup).toContain('Partner bank deposit approval queue');
    expect(depositsMarkup).toContain('Evidence &amp; preflight');
    expect(depositsMarkup).toContain('Wallet allocation');
    expect(depositsMarkup).toContain('finance-approval-deposit-table');
    expect(depositsMarkup).toContain('finance-approval-decision-actions');
    expect(depositsMarkup).not.toContain('Partner withdrawal work queue');
    expect(withdrawalsMarkup).toContain('Partner withdrawal work queue');
    expect(withdrawalsMarkup).not.toContain('Wallet adjustment approval queue');
    expect(walletMarkup).toContain('Wallet adjustment approval queue');
    expect(walletMarkup).toContain('finance-approval-wallet-table');
    expect(walletMarkup).toContain('finance-approval-decision-actions');
    expect(walletMarkup).toContain('Review state');
    expect(walletMarkup).toContain('Ready');
    expect(walletMarkup).toContain('1 can be approved now');
    expect(walletMarkup).toContain('aria-label="Wallet adjustment approval queue"');
    expect(walletMarkup).toContain('Wallet adjustment records');
    expect(walletMarkup).not.toContain('Payment fee policy reviews');
  });

  it('filters wallet approvals by server-classified review state and preserves the selected queue', async () => {
    const page = await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        take: '25',
        view: 'wallet',
        walletReview: 'stale',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Wallet adjustments');
    expect(markup).toContain('There is no work in this approval queue');
    expect(markup).not.toContain('name="walletReview"');
    expect(markup).not.toContain('Wallet adjustment approval queue');
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/finance-approval-queue?take=25&view=wallet&walletReview=stale',
      expect.any(Object),
    );
  });

  it('marks empty approval command cards as clear instead of needs action', async () => {
    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'priority' }),
    }));

    expect(markup.match(/>Clear</g)).toHaveLength(5);
    expect(markup).not.toContain('Needs review');
    expect(markup).not.toContain('Bank action');
    expect(markup).toContain('Post-approval bank matching');
    expect(markup).toContain('0 follow-up');
  });

  it('puts ready payout and withdrawal paid closeouts in the oldest-first approval flow', async () => {
    const queue = {
      generatedAt: '2026-07-13T09:00:00.000Z',
      limit: 10,
      summary: {
        paymentFeePolicyPendingCount: 0,
        withdrawalOpenCount: 1,
        withdrawalRequestedCount: 0,
        withdrawalReviewRequiredCount: 0,
        withdrawalBankTransferPendingCount: 1,
        withdrawalOpenAmount: 400000,
        withdrawalCurrency: 'VND',
        walletAdjustmentLast7dCount: 0,
        walletAdjustmentPendingCount: 0,
        walletAdjustmentReadyCount: 0,
        walletAdjustmentBlockedCount: 0,
        walletAdjustmentStaleCount: 0,
        partnerBankDepositPendingCount: 0,
        partnerBankDepositLast7dCount: 0,
        refundPendingCount: 0,
        payoutBatchPendingCount: 1,
      },
      paymentFeePolicyRequests: [],
      withdrawalRequests: [{
        id: 'withdrawal-ready-1',
        providerProfileId: 'provider-1',
        partnerName: 'Partner Withdrawal',
        amount: 400000,
        currency: 'VND',
        status: 'BANK_TRANSFER_PENDING',
        hasBankAccount: true,
        reviewState: 'READY',
        createdAt: '2026-07-13T07:00:00.000Z',
        updatedAt: '2026-07-13T08:00:00.000Z',
        preflight: { canMarkPaid: true },
      }],
      payoutBatchRequests: [{
        id: 'payout-ready-1',
        providerProfileId: 'provider-2',
        partnerName: 'Partner Payout',
        totalNetAmount: 900000,
        currency: 'VND',
        status: 'PROCESSING',
        transferRef: 'VCB-PAYOUT-1',
        reviewState: 'READY',
        createdAt: '2026-07-13T07:30:00.000Z',
        paidCloseoutRequestedByAdminId: 'finance-maker-1',
        paidCloseoutRequestedBy: { id: 'finance-maker-1', fullName: 'Finance Maker' },
        preflight: { canMarkPaid: true },
      }],
      walletAdjustmentRequests: [],
      walletAdjustmentEvidence: { last7dCount: 0, pendingQueueSupported: true },
      partnerBankDepositRequests: [],
      refundRequests: [],
    };
    mockedAdminGet.mockImplementation(async (href, fallback) =>
      href.startsWith('/admin/finance-approval-queue') ? queue as never : fallback,
    );

    const priorityMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({}),
    }));
    const payoutConfirmationMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'approve-payout-paid',
        requestId: 'payout-ready-1',
        view: 'payouts',
      }),
    }));

    expect(priorityMarkup).toContain('Partner Withdrawal');
    expect(priorityMarkup).toContain('Partner Payout');
    expect(priorityMarkup).toContain('Independent approval');
    expect(priorityMarkup).toContain('confirm=approve-withdrawal-paid');
    expect(priorityMarkup).toContain('confirm=approve-payout-paid');
    expect(payoutConfirmationMarkup).toContain('Approve payout batch paid closeout?');
    expect(payoutConfirmationMarkup).toContain('900.000 VND');
    expect(payoutConfirmationMarkup).not.toContain('name="approvalAdminId"');
  });

  it('renders refund state mismatches as evidence-only rows without decision actions', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => href.startsWith('/admin/finance-approval-queue')
      ? {
          generatedAt: '2026-08-08T06:00:00.000Z',
          limit: 10,
          summary: {
            refundPendingCount: 1,
            refundReadyCount: 0,
            refundBlockedCount: 0,
            refundStateMismatchCount: 1,
          },
          refundRequests: [{
            id: 'refund-mismatch-1',
            paymentId: 'payment-refunded-1',
            bookingId: 'booking-refunded-1',
            amount: 250000,
            currency: 'VND',
            reason: 'Duplicate request',
            status: 'REQUESTED',
            source: 'ADMIN_MANUAL',
            requestedAt: '2026-08-08T05:00:00.000Z',
            requestedByAdminId: 'refund-maker',
            paymentMethod: 'CARD',
            paymentStatus: 'REFUNDED',
            reviewState: 'STATE_MISMATCH',
            blockers: [{
              code: 'PAYMENT_STATE_MISMATCH',
              message: 'Payment is REFUNDED; only CAPTURED payments can be refunded.',
            }],
            canApprove: false,
            canReject: false,
            createdAt: '2026-08-08T05:00:00.000Z',
          }],
        } as never
      : fallback);

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'refunds' }),
    }));

    expect(markup).toContain('State mismatch');
    expect(markup).toContain('Payment is REFUNDED; only CAPTURED payments can be refunded.');
    expect(markup).toContain('Open payment timeline');
    expect(markup).not.toContain('Approve refund');
    expect(markup).not.toContain('confirm=reject-refund');
  });

  it('loads an exact refund focus independently and restores the refund queue context', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => href.startsWith('/admin/finance-approval-queue')
      ? {
          generatedAt: '2026-08-09T02:00:00.000Z',
          limit: 10,
          summary: { refundPendingCount: 3, refundReadyCount: 3 },
          refundRequests: [],
          refundFocus: {
            requestId: 'refund-focus-1',
            state: 'FOUND',
            request: {
              id: 'refund-focus-1',
              paymentId: 'payment-focus-1',
              bookingId: 'booking-focus-1',
              amount: 250000,
              currency: 'VND',
              reason: 'Customer cancellation approved by support',
              status: 'REQUESTED',
              source: 'ADMIN_MANUAL',
              requestedAt: '2026-08-08T05:00:00.000Z',
              requestedByAdminId: 'refund-maker',
              paymentMethod: 'CARD',
              paymentStatus: 'CAPTURED',
              bookingStatus: 'CANCELLED',
              reviewState: 'READY',
              blockers: [],
              canApprove: true,
              canReject: true,
              createdAt: '2026-08-08T05:00:00.000Z',
            },
          },
        } as never
      : fallback);
    const returnTo = '/refunds?range=30d&review=requested&sort=newest&page=2';

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ requestId: 'refund-focus-1', returnTo, view: 'refunds' }),
    }));

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/finance-approval-queue?take=10&view=refunds&review=ready&requestId=refund-focus-1',
      expect.any(Object),
    );
    expect(markup).toContain('Focused refund decision');
    expect(markup).toContain('refund-focus-1');
    expect(markup).toContain('payment-focus-1');
    expect(markup).toContain('booking-focus-1');
    expect(markup).toContain('Approve refund');
    expect(markup).toContain('Back to refund queue');
    expect(markup).toContain('href="/refunds?range=30d&amp;review=requested&amp;sort=newest&amp;page=2"');
  });

  it('shows an exact state mismatch without approval actions and rejects unsafe return targets', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => href.startsWith('/admin/finance-approval-queue')
      ? {
          generatedAt: '2026-08-09T02:00:00.000Z',
          limit: 10,
          summary: { refundPendingCount: 1, refundStateMismatchCount: 1 },
          refundRequests: [],
          refundFocus: {
            requestId: 'refund-mismatch-1',
            state: 'FOUND',
            request: {
              id: 'refund-mismatch-1', paymentId: 'payment-refunded-1', bookingId: 'booking-cancelled-1',
              amount: 250000, currency: 'VND', reason: 'Duplicate request', status: 'REQUESTED',
              requestedAt: '2026-08-08T05:00:00.000Z', requestedByAdminId: 'refund-maker',
              paymentMethod: 'CARD', paymentStatus: 'REFUNDED', bookingStatus: 'CANCELLED',
              mismatchReason: 'Payment is REFUNDED; only CAPTURED payments can be refunded.',
              reviewState: 'STATE_MISMATCH', blockers: [], canApprove: false, canReject: false,
              createdAt: '2026-08-08T05:00:00.000Z',
            },
          },
        } as never
      : fallback);

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        requestId: 'refund-mismatch-1',
        returnTo: 'https://evil.example/refunds',
        view: 'refunds',
      }),
    }));

    expect(markup).toContain('State mismatch');
    expect(markup).toContain('Payment is REFUNDED; only CAPTURED payments can be refunded.');
    expect(markup).toContain('Escalate to payment operations');
    expect(markup).not.toContain('Approve refund');
    expect(markup).not.toContain('Reject request');
    expect(markup).toContain('href="/refunds?range=all&amp;review=open&amp;sort=oldest"');
    expect(markup).not.toContain('evil.example');
  });

  it('shows an explicit changed state when the exact refund no longer exists', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => href.startsWith('/admin/finance-approval-queue')
      ? {
          generatedAt: '2026-08-09T02:00:00.000Z',
          limit: 10,
          summary: {},
          refundRequests: [],
          refundFocus: { request: null, requestId: 'refund-gone-1', state: 'NOT_FOUND_OR_CHANGED' },
        } as never
      : fallback);

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ requestId: 'refund-gone-1', view: 'refunds' }),
    }));

    expect(markup).toContain('Refund request not found or no longer pending');
    expect(markup).toContain('Changed or unavailable');
    expect(markup).not.toContain('Approve refund');
  });

  it('keeps refund review state and page in the server query and navigation controls', async () => {
    mockedAdminGet.mockResolvedValue({
      generatedAt: '2026-08-09T02:00:00.000Z',
      limit: 10,
      pagination: {
        hasNext: true,
        hasPrevious: true,
        page: 2,
        review: 'state-mismatch',
        totalCount: 109,
      },
      summary: {
        refundPendingCount: 112,
        refundReadyCount: 3,
        refundBlockedCount: 0,
        refundStateMismatchCount: 109,
      },
      refundRequests: [],
    });

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ page: '2', review: 'state-mismatch', take: '10', view: 'refunds' }),
    }));

    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/finance-approval-queue?take=10&view=refunds&review=state-mismatch&page=2',
      expect.any(Object),
    );
    expect(markup).toContain('Review state');
    expect(markup).toContain('109 in this state · page 2');
    expect(markup).toContain('view=refunds&amp;review=state-mismatch');
    expect(markup).toContain('review=state-mismatch&amp;page=3');
    expect(markup).not.toContain('Approve refund');
  });

  it('shows the immutable evidence snapshot before a ready refund decision', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => href.startsWith('/admin/finance-approval-queue')
      ? {
          generatedAt: '2026-08-08T06:00:00.000Z',
          currentApprover: { id: 'finance-approver', fullName: 'Finance Approver' },
          limit: 10,
          summary: { refundPendingCount: 1, refundReadyCount: 1 },
          refundRequests: [{
            id: 'refund-ready-1',
            paymentId: 'payment-captured-1',
            bookingId: 'booking-captured-1',
            amount: 250000,
            currency: 'VND',
            reason: 'Verified customer cancellation',
            status: 'REQUESTED',
            source: 'ADMIN_MANUAL',
            requestedAt: '2026-08-08T05:00:00.000Z',
            requestedByAdminId: 'refund-maker',
            paymentMethod: 'CARD',
            paymentStatus: 'CAPTURED',
            reviewState: 'READY',
            blockers: [],
            canApprove: true,
            canReject: true,
            createdAt: '2026-08-08T05:00:00.000Z',
          }],
        } as never
      : fallback);

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'approve-refund',
        requestId: 'refund-ready-1',
        view: 'refunds',
      }),
    }));

    expect(markup).toContain('Approve customer payment refund?');
    expect(markup).toContain('Request ID');
    expect(markup).toContain('refund-ready-1');
    expect(markup).toContain('Current approver');
    expect(markup).toContain('Finance Approver');
    expect(markup).toContain('Independent control');
    expect(markup).toContain('GL / settlement / tax');
    expect(markup).toContain('Snapshot time');
  });

  it('does not present an API failure as an empty approval queue', async () => {
    mockedAdminGetResult.mockImplementation(async (href, fallback) => href.startsWith('/admin/finance-approval-queue')
      ? { data: fallback, ok: false, status: 503 }
      : { data: fallback, ok: true, status: 200 });

    const markup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({}),
    }));

    expect(markup).toContain('Finance approval data could not be loaded');
    expect(markup).toContain('No empty or zero queue state is being claimed');
    expect(markup).not.toContain('Oldest finance work');
    expect(markup).not.toContain('Finance approval command board');
  });

  it('defaults the queue to a bounded ten rows', async () => {
    await FinanceApprovalQueuePage({ searchParams: Promise.resolve({ take: '500' }) });

    expect(mockedAdminGet).toHaveBeenCalledWith('/admin/finance-approval-queue?take=10&view=priority', expect.any(Object));
    expect(mockedAdminGet).toHaveBeenCalledWith(
      '/admin/bank-reconciliation/summary?range=all&review=unmatched',
      expect.any(Object),
    );
  });

  it('shows server preflight blockers and lets the maker close only their stale request', async () => {
    mockedAdminGet.mockImplementation(async (href, fallback) => {
      if (href.startsWith('/admin/finance-approval-queue')) {
        return {
          generatedAt: '2026-07-13T09:00:00.000Z',
          limit: 10,
          summary: {
            paymentFeePolicyPendingCount: 0,
            withdrawalOpenCount: 0,
            withdrawalRequestedCount: 0,
            withdrawalReviewRequiredCount: 0,
            withdrawalBankTransferPendingCount: 0,
            withdrawalOpenAmount: 0,
            withdrawalCurrency: 'VND',
            walletAdjustmentLast7dCount: 0,
            walletAdjustmentPendingCount: 1,
            walletAdjustmentReadyCount: 0,
            walletAdjustmentBlockedCount: 0,
            walletAdjustmentStaleCount: 1,
            partnerBankDepositPendingCount: 1,
            partnerBankDepositLast7dCount: 0,
          },
          paymentFeePolicyRequests: [],
          withdrawalRequests: [],
          walletAdjustmentRequests: [{
            id: 'wallet-request-blocked',
            ownerType: 'PARTNER',
            ownerId: 'provider-1',
            direction: 'CREDIT',
            adjustmentType: 'PARTNER_BONUS',
            amount: 200000,
            currency: 'VND',
            reason: 'Recovery bonus',
            requestedBeforeBalance: 0,
            requestedAfterBalance: 200000,
            requiresAttachment: false,
            requestedByAdminId: 'wallet-maker',
            reviewState: 'STALE',
            createdAt: '2026-07-13T08:45:00.000Z',
            preflight: {
              blockers: [{
                code: 'WALLET_BALANCE_CHANGED',
                message: 'The wallet balance changed after the request was created.',
              }],
              canApprove: false,
              canCancel: true,
              canReject: false,
              currentAfterBalance: 250000,
              currentBeforeBalance: 50000,
              ready: false,
              warnings: [],
            },
          }],
          walletAdjustmentEvidence: { last7dCount: 0, pendingQueueSupported: true },
          partnerBankDepositRequests: [{
            id: 'deposit-request-ready',
            providerProfileId: 'provider-1',
            partnerName: 'Partner One',
            amount: 1000000,
            currency: 'VND',
            bankTransactionId: 'BIDV-20260713-002',
            depositDate: '2026-07-13T08:00:00.000Z',
            requestedBeforeBalance: 0,
            requestedAfterBalance: 1000000,
            requestedReceivableRecovery: 0,
            requestedWalletLiabilityIncrease: 1000000,
            createdAt: '2026-07-13T08:40:00.000Z',
            requestedBy: { id: 'deposit-maker' },
            preflight: {
              blockers: [],
              canApprove: true,
              canReject: true,
              currentAfterBalance: 1050000,
              currentBeforeBalance: 50000,
              ready: true,
              warnings: [{
                code: 'ALLOCATION_WILL_REFRESH',
                message: 'Execution will recalculate the wallet allocation.',
              }],
            },
          }],
        };
      }
      return fallback;
    });

    const walletMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'wallet' }),
    }));
    const depositMarkup = renderToStaticMarkup(await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({ view: 'deposits' }),
    }));

    expect(walletMarkup).toContain('Approval blocked');
    expect(walletMarkup).toContain('The wallet balance changed after the request was created.');
    expect(walletMarkup).not.toContain('confirm=approve-wallet');
    expect(walletMarkup).not.toContain('confirm=reject-wallet');
    expect(walletMarkup).toContain('confirm=cancel-wallet');
    expect(walletMarkup).toContain('Cancel stale request');
    expect(depositMarkup).toContain('Ready with review');
    expect(depositMarkup).toContain('Execution will recalculate the wallet allocation.');
    expect(depositMarkup).toContain('confirm=approve-deposit');
  });

  it('redirects the legacy reconciliation queue to the canonical bank workspace', async () => {
    await expect(FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        owner: 'unassigned',
        sla: 'escalate',
        take: '25',
        view: 'reconciliation',
      }),
    })).rejects.toThrow('REDIRECT:/finance-tax/bank-reconciliation?range=all&review=unmatched&workspace=operations&owner=unassigned&age=48h&take=25');

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/bank-reconciliation?range=all&review=unmatched&workspace=operations&owner=unassigned&age=48h&take=25',
    );
    expect(mockedAdminGet).not.toHaveBeenCalled();
  });

  it('redirects the legacy reconciliation confirmation without rendering a duplicate mutation surface', async () => {
    await expect(FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'assign-deposit-reconciliation',
        requestId: 'deposit-executed-1',
      }),
    })).rejects.toThrow('REDIRECT:/finance-tax/bank-reconciliation?range=all&review=unmatched&workspace=operations');

    expect(mockedAdminGet).not.toHaveBeenCalled();
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
        walletAdjustmentReadyCount: 1,
        walletAdjustmentBlockedCount: 0,
        walletAdjustmentStaleCount: 0,
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
          reviewState: 'READY',
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
    expect(walletMarkup).toContain('href="/finance-tax/approval-queue?view=wallet&amp;take=25"');
    expect(walletMarkup).toContain('confirm=reject-wallet&amp;requestId=wallet-request-1&amp;view=wallet&amp;take=25');
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
    expect(depositMarkup).toContain('href="/finance-tax/approval-queue?view=deposits&amp;take=25"');
    expect(depositMarkup).toContain('/finance-tax/partner-bank-deposits/deposit-request-1');
  });

  it('confirms stale maker cancellation without presenting an execution decision', async () => {
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
        walletAdjustmentLast7dCount: 0,
        walletAdjustmentPendingCount: 1,
        walletAdjustmentReadyCount: 0,
        walletAdjustmentBlockedCount: 0,
        walletAdjustmentStaleCount: 1,
        partnerBankDepositPendingCount: 0,
        partnerBankDepositLast7dCount: 0,
      },
      paymentFeePolicyRequests: [],
      withdrawalRequests: [],
      walletAdjustmentRequests: [{
        id: 'wallet-request-stale',
        ownerType: 'PARTNER',
        ownerId: 'provider-1',
        ownerName: 'Partner One',
        direction: 'CREDIT',
        adjustmentType: 'PARTNER_BONUS',
        amount: 200000,
        currency: 'VND',
        reason: 'Recovery bonus',
        requestedBeforeBalance: 0,
        requestedAfterBalance: 200000,
        requiresAttachment: false,
        requestedByAdminId: 'wallet-maker',
        reviewState: 'STALE',
        createdAt: '2026-07-15T08:45:00.000Z',
        preflight: {
          blockers: [{
            code: 'WALLET_BALANCE_CHANGED',
            message: 'The wallet balance changed after the request was created.',
          }],
          canApprove: false,
          canCancel: true,
          canReject: false,
          currentAfterBalance: 250000,
          currentBeforeBalance: 50000,
          ready: false,
          warnings: [],
        },
      }],
      walletAdjustmentEvidence: { last7dCount: 0, pendingQueueSupported: true },
      partnerBankDepositRequests: [],
    });

    const page = await FinanceApprovalQueuePage({
      searchParams: Promise.resolve({
        confirm: 'cancel-wallet',
        requestId: 'wallet-request-stale',
        take: '25',
        view: 'wallet',
        walletReview: 'stale',
      }),
    });
    const markup = renderToStaticMarkup(page);

    expect(markup).toContain('Cancel stale wallet adjustment request?');
    expect(markup).toContain('closes only the pending request');
    expect(markup).toContain('does not change wallet, bank, cash, tax, or accounting ledgers');
    expect(markup).toContain('name="reason"');
    expect(markup).toContain('Cancellation reason');
    expect(markup).toContain(
      'name="redirectTo" value="/finance-tax/approval-queue?view=wallet&amp;walletReview=stale&amp;take=25#approval-wallet-request-stale"',
    );
    expect(markup).not.toContain('Approve and execute wallet adjustment?');
  });
});

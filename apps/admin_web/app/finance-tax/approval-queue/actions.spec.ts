import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { AdminApiRequestError, adminPatchOrThrow, adminPostOrThrow } from '../../../lib/admin-api';
import {
  approvePayoutBatchPaidCloseout,
  approveRefundRequest,
  approvePartnerBankDepositRequest,
  approveWithdrawalPaidCloseout,
  approveWalletAdjustmentRequest,
  cancelStaleWalletAdjustmentRequest,
  decideCompanyBankAccountRequest,
  rejectRefundRequest,
  rejectPartnerBankDepositRequest,
  rejectWalletAdjustmentRequest,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../lib/admin-api', async () => {
  const actual = await vi.importActual<typeof import('../../../lib/admin-api')>('../../../lib/admin-api');
  return {
    ...actual,
    adminPatchOrThrow: vi.fn(),
    adminPostOrThrow: vi.fn(),
  };
});

const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);

describe('Finance Approval Queue actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatchOrThrow.mockResolvedValue({});
    mockedAdminPostOrThrow.mockResolvedValue({});
  });

  it.each([
    {
      action: approveWithdrawalPaidCloseout,
      id: 'withdrawal-pending-1',
      path: '/admin/provider-wallet/withdrawal-requests/withdrawal-pending-1',
    },
    {
      action: approvePayoutBatchPaidCloseout,
      id: 'payout-processing-1',
      path: '/admin/payout-batches/payout-processing-1',
    },
  ])('uses the authenticated Finance approver for $path', async ({ action, id, path }) => {
    const formData = new FormData();
    formData.set('requestId', id);
    formData.set('confirmationRequestId', id);
    formData.set('approvalAdminId', 'browser-supplied-admin');
    formData.set('transferRef', 'MALICIOUS-REPLACEMENT');
    formData.set('redirectTo', '/finance-tax/approval-queue?view=payouts&take=25');

    await action(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(path, { status: 'PAID' });
    expect(mockedRedirect).toHaveBeenCalledWith(
      `/finance-tax/approval-queue?view=payouts&take=25&approvalNotice=approved&requestId=${id}`,
    );
  });

  it('approves a persisted wallet request through the scoped Admin endpoint', async () => {
    const formData = new FormData();
    formData.set('requestId', 'wallet-request-1');
    formData.set('confirmationRequestId', 'wallet-request-1');

    await approveWalletAdjustmentRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests/wallet-request-1/approve',
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith('/finance-tax/approval-queue');
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('approvalNotice=approved'));
  });

  it('requires and forwards a rejection reason without touching the ledger directly', async () => {
    const formData = new FormData();
    formData.set('requestId', 'wallet-request-1');
    formData.set('confirmationRequestId', 'wallet-request-1');
    formData.set('reason', ' Missing supporting evidence ');

    await rejectWalletAdjustmentRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests/wallet-request-1/reject',
      { reason: 'Missing supporting evidence' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('approvalNotice=rejected'));
  });

  it('cancels a stale maker request without calling an execution endpoint', async () => {
    const formData = new FormData();
    formData.set('requestId', 'wallet-request-stale');
    formData.set('confirmationRequestId', 'wallet-request-stale');
    formData.set('reason', 'Live wallet balance changed after this request');
    formData.set(
      'redirectTo',
      '/finance-tax/approval-queue?view=wallet&walletReview=stale&take=25',
    );

    await cancelStaleWalletAdjustmentRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests/wallet-request-stale/cancel-stale',
      { reason: 'Live wallet balance changed after this request' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?view=wallet&walletReview=stale&take=25&approvalNotice=cancelled&requestId=wallet-request-stale',
    );
  });

  it('approves a persisted Partner bank deposit through the scoped decision endpoint', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('confirmationRequestId', 'deposit-request-1');

    await approvePartnerBankDepositRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/deposit-request-1/approve',
      {},
    );
    expect(revalidatePath).toHaveBeenCalledWith('/cash-settlements');
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('approvalNotice=approved'));
  });

  it('rejects a persisted Partner bank deposit without writing wallet or GL directly', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('confirmationRequestId', 'deposit-request-1');
    formData.set('reason', ' Bank evidence mismatch ');

    await rejectPartnerBankDepositRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/deposit-request-1/reject',
      { reason: 'Bank evidence mismatch' },
    );
  });

  it('decides a company bank account request with the signed-in approver and preserved queue view', async () => {
    const formData = new FormData();
    formData.set('bankAccountId', 'company-bank-account-1');
    formData.set('confirmationRequestId', 'bank-account-request-1');
    formData.set('decision', 'APPROVE');
    formData.set('operatorReason', 'Verified masked account against signed bank evidence');
    formData.set('requestId', 'bank-account-request-1');
    formData.set('redirectTo', '/finance-tax/approval-queue?view=bank-accounts&take=25');
    formData.set('approvalAdminId', 'browser-supplied-admin');

    await decideCompanyBankAccountRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/company-bank-accounts/company-bank-account-1/approval-decision',
      {
        decision: 'APPROVE',
        operatorReason: 'Verified masked account against signed bank evidence',
        requestId: 'bank-account-request-1',
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith('/finance-tax/company-bank-accounts');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?view=bank-accounts&take=25&approvalNotice=approved&requestId=bank-account-request-1',
    );
  });

  it('approves a refund request through the payment endpoint without sending an approver id', async () => {
    const formData = new FormData();
    formData.set('requestId', 'refund-request-1');
    formData.set('confirmationRequestId', 'refund-request-1');
    formData.set('paymentId', 'payment-1');
    formData.set('redirectTo', '/finance-tax/approval-queue?view=refunds&take=25');

    await approveRefundRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/payments/payment-1/refund',
      {},
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?view=refunds&take=25&approvalNotice=approved&requestId=refund-request-1',
    );
  });

  it('rejects a refund request with evidence and preserves the focused queue', async () => {
    const formData = new FormData();
    formData.set('requestId', 'refund-request-1');
    formData.set('confirmationRequestId', 'refund-request-1');
    formData.set('reason', 'Customer evidence does not support refund');
    formData.set('redirectTo', '/finance-tax/approval-queue?view=refunds');

    await rejectRefundRequest(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/refunds/refund-request-1/reject',
      { reason: 'Customer evidence does not support refund' },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?view=refunds&approvalNotice=rejected&requestId=refund-request-1',
    );
  });

  it('returns a safe state-mismatch notice when payment state changes during refund approval', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new AdminApiRequestError(
      'POST',
      '/admin/payments/payment-1/refund',
      409,
      { message: 'Payment is already REFUNDED' },
    ));
    const formData = new FormData();
    formData.set('requestId', 'refund-request-1');
    formData.set('confirmationRequestId', 'refund-request-1');
    formData.set('paymentId', 'payment-1');
    formData.set('redirectTo', '/finance-tax/approval-queue?view=refunds');

    await approveRefundRequest(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?view=refunds&approvalNotice=state-mismatch&requestId=refund-request-1',
    );
  });

  it('blocks a stale or direct approval submission without matching confirmation evidence', async () => {
    const formData = new FormData();
    formData.set('requestId', 'wallet-request-1');
    formData.set('confirmationRequestId', 'another-request');

    await approveWalletAdjustmentRequest(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('approvalNotice=failed'));
  });

  it('requires a meaningful rejection reason before calling the decision endpoint', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('confirmationRequestId', 'deposit-request-1');
    formData.set('reason', 'Too short');

    await rejectPartnerBankDepositRequest(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('approvalNotice=reason-required'));
  });

  it('preserves the bounded queue size after a confirmed decision', async () => {
    const formData = new FormData();
    formData.set('requestId', 'wallet-request-1');
    formData.set('confirmationRequestId', 'wallet-request-1');
    formData.set('redirectTo', '/finance-tax/approval-queue?take=25&confirm=approve-wallet');

    await approveWalletAdjustmentRequest(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?take=25&approvalNotice=approved&requestId=wallet-request-1',
    );
  });
});

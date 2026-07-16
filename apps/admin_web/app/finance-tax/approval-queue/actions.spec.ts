import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../../lib/admin-api';
import {
  approvePartnerBankDepositRequest,
  approveWalletAdjustmentRequest,
  assignPartnerBankDepositReconciliationReview,
  rejectPartnerBankDepositRequest,
  rejectWalletAdjustmentRequest,
} from './actions';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('../../../lib/admin-api', () => ({ adminPostOrThrow: vi.fn() }));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);

describe('Finance Approval Queue actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({});
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

  it('assigns deposit reconciliation ownership without writing finance ledgers directly', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('confirmationRequestId', 'deposit-request-1');
    formData.set('assigneeAdminId', 'finance-operator-1');
    formData.set('reason', ' Own overdue bank evidence ');
    formData.set(
      'redirectTo',
      '/finance-tax/approval-queue?view=reconciliation&take=25&confirm=assign-deposit-reconciliation',
    );

    await assignPartnerBankDepositReconciliationReview(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/deposit-request-1/reconciliation-assignment',
      {
        assigneeAdminId: 'finance-operator-1',
        reason: 'Own overdue bank evidence',
      },
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/approval-queue?view=reconciliation&take=25&assignmentNotice=assigned&requestId=deposit-request-1',
    );
  });

  it('blocks deposit reconciliation assignment without confirmation and a meaningful reason', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('confirmationRequestId', 'another-request');
    formData.set('assigneeAdminId', 'finance-operator-1');
    formData.set('reason', 'Too short');

    await assignPartnerBankDepositReconciliationReview(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('assignmentNotice=failed'));
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

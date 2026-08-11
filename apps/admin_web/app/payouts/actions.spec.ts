import { revalidatePath } from 'next/cache';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { adminPatchOrThrow, adminPostOrThrow } from '../../lib/admin-api';
import {
  markPayoutPaid,
  reversePaidPayout,
  reversePaidProviderWalletWithdrawal,
  updateProviderWalletWithdrawalRequest,
  updatePayoutTransferRef,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPatchOrThrow: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('payout server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('marks a payout batch paid without forwarding browser-supplied evidence or approver identity', async () => {
    const formData = new FormData();
    formData.set('payoutBatchId', 'payout-batch-1');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('transferRef', 'MALICIOUS-REPLACEMENT');

    await markPayoutPaid(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/payout-batches/payout-batch-1',
      { status: 'PAID' },
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/payouts');
  });

  it('saves transfer evidence only for the reconfirmed selected payout snapshot', async () => {
    const formData = new FormData();
    formData.set('payoutBatchId', 'payout-batch-1');
    formData.set('confirmationPayoutBatchId', 'payout-batch-1');
    formData.set('expectedStatus', 'DRAFT');
    formData.set('expectedTransferRef', 'OLD-REF');
    formData.set('expectedNotes', 'Old note');
    formData.set('transferRef', 'NEW-REF');
    formData.set('notes', 'Verified bank transfer');
    formData.set('reason', 'Bank receipt was checked by Finance');

    await updatePayoutTransferRef(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith('/admin/payout-batches/payout-batch-1', {
      confirmationPayoutBatchId: 'payout-batch-1',
      expectedNotes: 'Old note',
      expectedStatus: 'DRAFT',
      expectedTransferRef: 'OLD-REF',
      notes: 'Verified bank transfer',
      reason: 'Bank receipt was checked by Finance',
      transferRef: 'NEW-REF',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('rejects a payout transfer edit when the operator reconfirms another target', async () => {
    const formData = new FormData();
    formData.set('payoutBatchId', 'payout-batch-1');
    formData.set('confirmationPayoutBatchId', 'payout-batch-2');
    formData.set('reason', 'Bank receipt was checked by Finance');

    await expect(updatePayoutTransferRef(formData)).rejects.toThrow(
      'Reconfirmed payout batch does not match the selected target',
    );
    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
  });

  it('marks a withdrawal paid without forwarding browser-supplied evidence or approver identity', async () => {
    const formData = new FormData();
    formData.set('requestId', 'withdrawal-1');
    formData.set('status', 'PAID');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('transferRef', 'MALICIOUS-REPLACEMENT');

    await updateProviderWalletWithdrawalRequest(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/withdrawal-requests/withdrawal-1',
      { status: 'PAID' },
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/payouts');
  });

  it.each([
    {
      action: reversePaidPayout,
      idField: 'payoutBatchId',
      id: 'payout-batch-1',
      path: '/admin/payout-batches/payout-batch-1/reversal',
    },
    {
      action: reversePaidProviderWalletWithdrawal,
      idField: 'requestId',
      id: 'withdrawal-1',
      path: '/admin/provider-wallet/withdrawal-requests/withdrawal-1/reversal',
    },
  ])('posts dual-approved bank evidence for $path', async ({ action, idField, id, path }) => {
    const formData = new FormData();
    formData.set(idField, id);
    formData.set('approvalAdminId', 'finance-approver-2');
    formData.set('reason', 'Bank returned the paid transfer to the company');
    formData.set('reversalReference', 'BANK-RETURN-001');
    formData.set('attachmentUrl', 'https://storage.example/reversal.jpg');

    await action(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(path, {
      approvalAdminId: 'finance-approver-2',
      reason: 'Bank returned the paid transfer to the company',
      reversalReference: 'BANK-RETURN-001',
      attachmentUrl: 'https://storage.example/reversal.jpg',
      attachmentFileId: undefined,
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/settlement-reversals');
  });
});

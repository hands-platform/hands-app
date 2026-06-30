import { revalidatePath } from 'next/cache';
import { describe, expect, it, beforeEach, vi } from 'vitest';

import { adminPatch, adminPatchOrThrow } from '../../lib/admin-api';
import { markPayoutPaid, updateProviderWalletWithdrawalRequest } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPatch: vi.fn(),
  adminPatchOrThrow: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatch);
const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('payout server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires transfer reference before marking a payout batch paid', async () => {
    const formData = new FormData();
    formData.set('payoutBatchId', 'payout-batch-1');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('transferRef', '   ');

    await expect(markPayoutPaid(formData)).rejects.toThrow(
      'Payout batch paid closeout requires a transfer reference',
    );

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('requires transfer reference before marking a provider wallet withdrawal paid', async () => {
    const formData = new FormData();
    formData.set('requestId', 'withdrawal-1');
    formData.set('status', 'PAID');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('transferRef', '   ');

    await expect(updateProviderWalletWithdrawalRequest(formData)).rejects.toThrow(
      'Provider wallet withdrawal paid closeout requires a transfer reference',
    );

    expect(mockedAdminPatch).not.toHaveBeenCalled();
    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { adminPost, adminPostOrThrow } from '../../lib/admin-api';
import { recordPartnerBankDeposit } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPost: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('cash settlement server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({ id: 'wallet-deposit-1' });
  });

  it('records a partner bank deposit with separate finance approval evidence', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', ' provider-1 ');
    formData.set('amount', '1000000');
    formData.set('bankTransactionId', ' BIDV-20260629-001 ');
    formData.set('depositDate', '2026-06-29T09:30');
    formData.set('bankAccount', ' BIDV 123456789 ');
    formData.set('attachmentUrl', ' https://example.test/deposit-proof.pdf ');
    formData.set('notes', ' Partner deposit confirmed ');
    formData.set('approvalAdminId', ' finance-admin-2 ');

    await recordPartnerBankDeposit(formData);

    expect(adminPost).not.toHaveBeenCalled();
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/provider-wallet/deposits', {
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30',
      bankAccount: 'BIDV 123456789',
      attachmentUrl: 'https://example.test/deposit-proof.pdf',
      notes: 'Partner deposit confirmed',
      approvalAdminId: 'finance-admin-2',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/cash-settlements');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/partners');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
  });

  it('rejects partner bank deposits without finance approval before calling the Admin API', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', 'provider-1');
    formData.set('amount', '1000000');
    formData.set('bankTransactionId', 'BIDV-20260629-001');
    formData.set('depositDate', '2026-06-29T09:30');
    formData.set('attachmentUrl', 'https://example.test/deposit-proof.pdf');

    await expect(recordPartnerBankDeposit(formData)).rejects.toThrow(
      'Partner bank deposit requires approval from a finance approver',
    );

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

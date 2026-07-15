import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { adminPost, adminPostOrThrow } from '../../lib/admin-api';
import { recordPartnerBankDeposit, settleCashFeeDebt } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPost: vi.fn(),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedAdminPost = vi.mocked(adminPost);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('cash settlement server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({ id: 'wallet-deposit-1' });
    mockedAdminPost.mockResolvedValue({ id: 'earning-1' });
  });

  it('creates a persistent partner bank deposit approval request', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', ' provider-1 ');
    formData.set('amount', '1000000');
    formData.set('bankTransactionId', ' BIDV-20260629-001 ');
    formData.set('depositDate', '2026-06-29T09:30');
    formData.set('bankAccount', ' BIDV 123456789 ');
    formData.set('attachmentUrl', ' https://example.test/deposit-proof.pdf ');
    formData.set('notes', ' Partner deposit confirmed ');

    await recordPartnerBankDeposit(formData);

    expect(adminPost).not.toHaveBeenCalled();
    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/provider-wallet/deposit-requests', {
      providerProfileId: 'provider-1',
      amount: 1000000,
      bankTransactionId: 'BIDV-20260629-001',
      depositDate: '2026-06-29T09:30',
      bankAccount: 'BIDV 123456789',
      attachmentUrl: 'https://example.test/deposit-proof.pdf',
      notes: 'Partner deposit confirmed',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/cash-settlements');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/partners');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/audit-log');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/approval-queue');
  });

  it('rejects partner bank deposit requests without attachment evidence before calling the Admin API', async () => {
    const formData = new FormData();
    formData.set('providerProfileId', 'provider-1');
    formData.set('amount', '1000000');
    formData.set('bankTransactionId', 'BIDV-20260629-001');
    formData.set('depositDate', '2026-06-29T09:30');

    await expect(recordPartnerBankDeposit(formData)).rejects.toThrow(
      'Partner bank deposit requires attachment evidence',
    );

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('keeps direct cash-debt settlement limited to documented admin offsets', async () => {
    const formData = new FormData();
    formData.set('earningId', 'earning-1');
    formData.set('settlementMethod', 'ADMIN_OFFSET');
    formData.set('settlementRef', 'OFFSET-001');
    formData.set('settlementNotes', 'Approved compensation offset');

    await settleCashFeeDebt(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/earnings/earning-1/mark-paid', {
      settlementMethod: 'ADMIN_OFFSET',
      settlementRef: 'OFFSET-001',
      settlementNotes: 'Approved compensation offset',
    }, null);
  });

  it('rejects direct Partner deposit settlement before calling the Admin API', async () => {
    const formData = new FormData();
    formData.set('earningId', 'earning-1');
    formData.set('settlementMethod', 'PARTNER_DEPOSIT');

    await expect(settleCashFeeDebt(formData)).rejects.toThrow(
      'Approved Partner deposits must be allocated from the deposit detail',
    );
    expect(mockedAdminPost).not.toHaveBeenCalled();
  });
});

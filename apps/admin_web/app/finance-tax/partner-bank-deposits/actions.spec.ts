import { revalidatePath } from 'next/cache';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../../lib/admin-api';
import { allocatePartnerBankDepositCashDebt } from './actions';
import { PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT } from './partner-bank-deposit-action-contract';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../../../lib/admin-api', () => ({ adminPostOrThrow: vi.fn() }));

describe('Partner bank deposit actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(adminPostOrThrow).mockResolvedValue({ allocation: { id: 'allocation-1' } });
  });

  it('allocates approved deposit evidence to an explicit cash debt', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('earningId', 'earning-1');
    formData.set('amount', '170000');
    formData.set('confirmationIntent', PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT);
    formData.set('notes', 'Match approved bank evidence to this cash-booking debt');

    await allocatePartnerBankDepositCashDebt(formData);

    expect(adminPostOrThrow).toHaveBeenCalledWith(
      '/admin/provider-wallet/deposit-requests/deposit-request-1/cash-debt-allocations',
      {
        earningId: 'earning-1',
        amount: 170000,
        notes: 'Match approved bank evidence to this cash-booking debt',
      },
    );
    expect(revalidatePath).toHaveBeenCalledWith('/cash-settlements');
    expect(revalidatePath).toHaveBeenCalledWith('/finance-tax/partner-bank-deposits/deposit-request-1');
  });

  it('rejects invalid allocation forms before the API call', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('earningId', 'earning-1');
    formData.set('amount', '0');

    await expect(allocatePartnerBankDepositCashDebt(formData)).rejects.toThrow(
      'Deposit allocation requires reviewed evidence, a reason, and explicit confirmation',
    );
    expect(adminPostOrThrow).not.toHaveBeenCalled();
  });

  it('rejects allocations without explicit confirmation or a sufficient audit reason', async () => {
    const formData = new FormData();
    formData.set('requestId', 'deposit-request-1');
    formData.set('earningId', 'earning-1');
    formData.set('amount', '170000');
    formData.set('confirmationIntent', PARTNER_BANK_DEPOSIT_ALLOCATION_CONFIRMATION_INTENT);
    formData.set('notes', 'Too short');

    await expect(allocatePartnerBankDepositCashDebt(formData)).rejects.toThrow(
      'Deposit allocation requires reviewed evidence, a reason, and explicit confirmation',
    );
    expect(adminPostOrThrow).not.toHaveBeenCalled();
  });
});

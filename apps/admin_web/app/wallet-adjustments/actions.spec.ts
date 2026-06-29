import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { vi } from 'vitest';

import { adminPostOrThrow } from '../../lib/admin-api';
import { createManualWalletAdjustment } from './actions';
import * as walletAdjustmentActions from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPostOrThrow: vi.fn(),
  isAdminApiAuthError: vi.fn((error: unknown) => error instanceof Error && error.message === 'auth'),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);
const mockedRedirect = vi.mocked(redirect);

describe('manual wallet adjustment server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPostOrThrow.mockResolvedValue({
      ledger: { id: 'ledger-1', amount: 200000, currency: 'VND' },
      preview: { afterBalance: 200000, beforeBalance: 0 },
    });
  });

  it('posts a trimmed manual adjustment payload through the Admin API boundary', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', ' provider-1 ');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '200000');
    formData.set('approvalId', ' approval-2026-06 ');
    formData.set('reason', ' Completed launch bonus ');
    formData.set('monthlyPeriod', '2026-06');
    formData.set('attachmentUrl', ' https://example.test/evidence.pdf ');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/wallet-adjustments', {
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      approvalId: 'approval-2026-06',
      attachmentUrl: 'https://example.test/evidence.pdf',
      direction: 'CREDIT',
      monthlyPeriod: '2026-06',
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      reason: 'Completed launch bonus',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/wallet-adjustments');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/partners');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/customers');
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('adjustmentNotice=created'),
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
  });

  it('redirects to a form notice when the Admin API rejects creation', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new Error('rejected'));
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '200000');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('reason', 'Rejected by API');

    await createManualWalletAdjustment(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=failed'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
  });

  it('redirects to an auth notice when the Admin token is missing or expired', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new Error('auth'));
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '200000');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('reason', 'Auth failure');

    await createManualWalletAdjustment(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=admin-auth'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
  });

  it('redirects unsafe or incomplete adjustment requests before posting', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '0');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('reason', 'No amount');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=failed'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
  });

  it('exports only async server actions from the server action module', () => {
    expect(Object.keys(walletAdjustmentActions)).toEqual(['createManualWalletAdjustment']);
  });
});

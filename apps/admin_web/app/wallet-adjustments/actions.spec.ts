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
    formData.set('approvalAdminId', ' finance-admin-2 ');
    formData.set('reason', ' Completed launch bonus ');
    formData.set('monthlyPeriod', '2026-06');
    formData.set('attachmentUrl', ' https://example.test/evidence.pdf ');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/wallet-adjustment-requests', {
      adjustmentType: 'PARTNER_BONUS',
      amount: 200000,
      attachmentUrl: 'https://example.test/evidence.pdf',
      direction: 'CREDIT',
      monthlyPeriod: '2026-06',
      ownerId: 'provider-1',
      ownerType: 'PARTNER',
      reason: 'Completed launch bonus',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/wallet-adjustments');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/approval-queue');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/partners');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/customers');
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('adjustmentNotice=requested'),
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('approvalId='));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('approvalAdminId='));
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
    formData.set('approvalAdminId', 'finance-admin-2');
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
    formData.set('approvalAdminId', 'finance-admin-2');
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
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('reason', 'No amount');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=failed'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
  });

  it('submits a persistent request without asking the maker for approval identifiers', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '200000');
    formData.set('reason', 'Needs approval');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith(
      '/admin/wallet-adjustment-requests',
      expect.objectContaining({ ownerId: 'provider-1', amount: 200000 }),
    );
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=requested'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('direction=CREDIT'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentType=PARTNER_BONUS'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('amount=200000'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('reason=Needs+approval'));
  });

  it('requires attachment evidence before posting high amount or receivable write-off adjustments', async () => {
    const highAmount = new FormData();
    highAmount.set('ownerType', 'PARTNER');
    highAmount.set('ownerId', 'provider-1');
    highAmount.set('direction', 'CREDIT');
    highAmount.set('adjustmentType', 'PARTNER_BONUS');
    highAmount.set('amount', '10000000');
    highAmount.set('approvalId', 'approval-2026-06');
    highAmount.set('approvalAdminId', 'finance-admin-2');
    highAmount.set('reason', 'High amount adjustment');

    await createManualWalletAdjustment(highAmount);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=attachment-required'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('amount=10000000'));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('approvalId='));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('approvalAdminId='));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('reason=High+amount+adjustment'));

    vi.clearAllMocks();

    const writeOff = new FormData();
    writeOff.set('ownerType', 'PARTNER');
    writeOff.set('ownerId', 'provider-1');
    writeOff.set('direction', 'CREDIT');
    writeOff.set('adjustmentType', 'RECEIVABLE_WRITE_OFF');
    writeOff.set('amount', '100000');
    writeOff.set('approvalId', 'approval-2026-06');
    writeOff.set('approvalAdminId', 'finance-admin-2');
    writeOff.set('reason', 'Write off approved by finance');

    await createManualWalletAdjustment(writeOff);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=attachment-required'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentType=RECEIVABLE_WRITE_OFF'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('reason=Write+off+approved+by+finance'));
  });

  it('rejects unsafe attachment URLs before posting to the Admin API', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '10000000');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('attachmentUrl', 'javascript:alert(1)');
    formData.set('reason', 'Unsafe evidence URL');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=attachment-invalid'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('reason=Unsafe+evidence+URL'));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('javascript'));
  });

  it('rejects invalid monthly periods before posting to the Admin API', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '200000');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('monthlyPeriod', '2026/06');
    formData.set('reason', 'Malformed monthly period');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=monthly-period-invalid'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('reason=Malformed+monthly+period'));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('2026%2F06'));
  });

  it('rejects impossible monthly periods before posting to the Admin API', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'CREDIT');
    formData.set('adjustmentType', 'PARTNER_BONUS');
    formData.set('amount', '200000');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('monthlyPeriod', '2026-13');
    formData.set('reason', 'Impossible monthly period');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=monthly-period-invalid'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('reason=Impossible+monthly+period'));
    expect(mockedRedirect).not.toHaveBeenCalledWith(expect.stringContaining('2026-13'));
  });

  it('blocks cash booking deduction from the manual wallet adjustment action', async () => {
    const formData = new FormData();
    formData.set('ownerType', 'PARTNER');
    formData.set('ownerId', 'provider-1');
    formData.set('direction', 'DEBIT');
    formData.set('adjustmentType', 'CASH_BOOKING_DEDUCTION');
    formData.set('amount', '200000');
    formData.set('approvalId', 'approval-2026-06');
    formData.set('approvalAdminId', 'finance-admin-2');
    formData.set('reason', 'Cash booking settlement should use settlement flow');

    await createManualWalletAdjustment(formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('adjustmentNotice=settlement-required'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerType=PARTNER'));
    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('ownerId=provider-1'));
  });

  it('exports only async server actions from the server action module', () => {
    expect(Object.keys(walletAdjustmentActions)).toEqual(['createManualWalletAdjustment']);
  });
});

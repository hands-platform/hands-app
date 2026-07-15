import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatchOrThrow } from '../../../lib/admin-api';
import { updateMonthlyTaxClosingStatus } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../../lib/admin-api', () => ({
  adminPatchOrThrow: vi.fn(),
}));

const mockedAdminPatchOrThrow = vi.mocked(adminPatchOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('monthly tax closing actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatchOrThrow.mockResolvedValue(undefined);
  });

  it('updates monthly tax closing status through the admin API', async () => {
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'DECLARED');
    formData.set('confirmationPeriod', '2026-06');
    formData.set('confirmationStatus', 'DECLARED');
    formData.set('notes', ' Submitted to tax portal ');
    formData.set('returnTo', '/finance-tax/monthly-tax-closing?period=2026-06');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/monthly-tax-closings/2026-06/status',
      {
        approvalAdminId: null,
        notes: 'Submitted to tax portal',
        paidAt: null,
        remittanceChannel: null,
        remittanceEvidenceUrl: null,
        remittanceTransferRef: null,
        status: 'DECLARED',
      },
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/monthly-tax-closing');
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/monthly-tax-closing?period=2026-06&closingNotice=updated',
    );
  });

  it('falls back to the monthly closing page for unsafe return paths', async () => {
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'PAID');
    formData.set('confirmationPeriod', '2026-06');
    formData.set('confirmationStatus', 'PAID');
    formData.set('returnTo', '/partners');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/monthly-tax-closing?period=2026-06&closingNotice=updated',
    );
  });

  it('passes partner withholding remittance evidence when marking the period paid', async () => {
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'PAID');
    formData.set('confirmationPeriod', '2026-06');
    formData.set('confirmationStatus', 'PAID');
    formData.set('paidAt', '2026-07-01T04:30');
    formData.set('approvalAdminId', ' finance-admin-2 ');
    formData.set('remittanceTransferRef', ' VCB-TAX-202606 ');
    formData.set('remittanceChannel', ' VCB_MANUAL_TRANSFER ');
    formData.set('remittanceEvidenceUrl', ' https://evidence.example/remittance.pdf ');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedAdminPatchOrThrow).toHaveBeenCalledWith(
      '/admin/monthly-tax-closings/2026-06/status',
      expect.objectContaining({
        approvalAdminId: 'finance-admin-2',
        paidAt: '2026-07-01T04:30',
        remittanceChannel: 'VCB_MANUAL_TRANSFER',
        remittanceEvidenceUrl: 'https://evidence.example/remittance.pdf',
        remittanceTransferRef: 'VCB-TAX-202606',
        status: 'PAID',
      }),
    );
  });

  it('blocks a stale or direct status submission without matching confirmation evidence', async () => {
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'DECLARED');
    formData.set('confirmationPeriod', '2026-06');
    formData.set('confirmationStatus', 'PAID');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedAdminPatchOrThrow).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/monthly-tax-closing?period=2026-06&closingNotice=confirmation-required',
    );
  });

  it('shows an explicit failure notice when the API rejects a closeout gate or stale transition', async () => {
    mockedAdminPatchOrThrow.mockRejectedValueOnce(new Error('Monthly closing transition blocked'));
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'CLOSED');
    formData.set('confirmationPeriod', '2026-06');
    formData.set('confirmationStatus', 'CLOSED');
    formData.set('returnTo', '/finance-tax/monthly-tax-closing?period=2026-06&take=25&page=2');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedRedirect).toHaveBeenCalledWith(
      '/finance-tax/monthly-tax-closing?period=2026-06&take=25&page=2&closingNotice=failed',
    );
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

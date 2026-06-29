import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { adminPatch } from '../../../lib/admin-api';
import { updateMonthlyTaxClosingStatus } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}));

vi.mock('../../../lib/admin-api', () => ({
  adminPatch: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatch);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('monthly tax closing actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedAdminPatch.mockResolvedValue(undefined);
  });

  it('updates monthly tax closing status through the admin API', async () => {
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'DECLARED');
    formData.set('notes', ' Submitted to tax portal ');
    formData.set('returnTo', '/finance-tax/monthly-tax-closing?period=2026-06');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/monthly-tax-closings/2026-06/status',
      {
        notes: 'Submitted to tax portal',
        status: 'DECLARED',
      },
      null,
    );
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax');
    expect(mockedRevalidatePath).toHaveBeenCalledWith('/finance-tax/monthly-tax-closing');
    expect(mockedRedirect).toHaveBeenCalledWith('/finance-tax/monthly-tax-closing?period=2026-06');
  });

  it('falls back to the monthly closing page for unsafe return paths', async () => {
    const formData = new FormData();
    formData.set('period', '2026-06');
    formData.set('status', 'PAID');
    formData.set('returnTo', '/partners');

    await updateMonthlyTaxClosingStatus(formData);

    expect(mockedRedirect).toHaveBeenCalledWith('/finance-tax/monthly-tax-closing');
  });
});

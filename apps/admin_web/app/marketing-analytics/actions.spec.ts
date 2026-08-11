import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { AdminApiRequestError, adminPostOrThrow } from '../../lib/admin-api';
import { upsertMarketingSpendDaily } from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/admin-api')>()),
  adminPostOrThrow: vi.fn(),
}));

const mockedAdminPostOrThrow = vi.mocked(adminPostOrThrow);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('marketing analytics server actions', () => {
  beforeEach(() => {
    mockedAdminPostOrThrow.mockResolvedValue(undefined);
    mockedRevalidatePath.mockClear();
  });

  it('posts a normalized daily spend payload and refreshes marketing views', async () => {
    const formData = new FormData();
    formData.set('spendDate', ' 2026-06-20 ');
    formData.set('source', ' google ');
    formData.set('platform', ' android ');
    formData.set('regionCode', ' hcm ');
    formData.set('campaignId', ' launch-hcm ');
    formData.set('campaignName', ' Launch HCMC ');
    formData.set('spendAmount', '600000');
    formData.set('currency', ' vnd ');
    formData.set('expectedUpdatedAt', ' 2026-06-21T02:00:00.000Z ');
    formData.set('notes', ' manual import ');
    formData.set('reason', ' correct Google invoice total ');

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).toHaveBeenCalledWith('/admin/marketing/spend-daily', {
      spendDate: '2026-06-20',
      source: 'google',
      platform: 'android',
      regionCode: 'hcm',
      campaignId: 'launch-hcm',
      campaignName: 'Launch HCMC',
      spendAmount: 600000,
      currency: 'VND',
      expectedUpdatedAt: '2026-06-21T02:00:00.000Z',
      notes: 'manual import',
      reason: 'correct Google invoice total',
    });
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/marketing-analytics',
      '/audit-log',
    ]);
    expect(result).toMatchObject({
      saved: {
        campaignId: 'launch-hcm',
        reason: 'correct Google invoice total',
        spendAmount: 600_000,
        spendDate: '2026-06-20',
      },
      status: 'success',
    });
  });

  it('returns field errors without calling the API when required spend fields are missing', async () => {
    const formData = new FormData();
    formData.set('source', 'google');

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, formData);

    expect(mockedAdminPostOrThrow).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      fieldErrors: {
        reason: 'Explain the change in at least 12 characters.',
        spendAmount: 'Enter a whole VND amount of zero or more.',
        spendDate: 'Spend date is required.',
      },
      status: 'invalid',
    });
  });

  it.each([
    [409, 'conflict'],
    [403, 'forbidden'],
    [503, 'unavailable'],
    [400, 'error'],
  ] as const)('classifies a %s API response as %s', async (status, expectedStatus) => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/marketing/spend-daily', status),
    );
    const formData = validSpendFormData();

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, formData);

    expect(result.status).toBe(expectedStatus);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('classifies a network failure as unavailable', async () => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(new Error('network down'));

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, validSpendFormData());

    expect(result).toMatchObject({ status: 'unavailable' });
  });
});

function validSpendFormData() {
  const formData = new FormData();
  formData.set('spendDate', '2026-06-20');
  formData.set('source', 'google');
  formData.set('spendAmount', '600000');
  formData.set('reason', 'correct invoice total');
  return formData;
}

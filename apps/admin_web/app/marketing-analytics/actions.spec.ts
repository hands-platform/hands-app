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
        platform: 'Spend platform is required.',
        reason: 'Explain the change in at least 12 characters.',
        spendAmount: 'Enter a whole VND amount from zero to 2,000,000,000.',
        spendDate: 'Spend date is required.',
      },
      status: 'invalid',
    });
  });

  it.each([
    [401, 'unauthorized'],
    [409, 'conflict'],
    [403, 'forbidden'],
    [429, 'throttled'],
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

  it('returns an exact saved receipt and refreshes affected workspaces once', async () => {
    mockedAdminPostOrThrow.mockResolvedValueOnce({
      auditId: 'audit-marketing-1',
      campaignId: 'launch-hcm',
      canonicalTarget: 'marketing_spend_daily:google:android:all:launch-hcm:2026-06-20',
      platform: 'android',
      source: 'google',
      spendAmount: 600_000,
      spendDate: '2026-06-20',
      status: 'SAVED',
      updatedAt: '2026-06-21T02:00:00.000Z',
    });

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, validSpendFormData());

    expect(result).toMatchObject({
      saved: {
        auditId: 'audit-marketing-1',
        canonicalTarget: 'marketing_spend_daily:google:android:all:launch-hcm:2026-06-20',
        outcome: 'SAVED',
      },
      status: 'success',
    });
    expect(mockedRevalidatePath).toHaveBeenCalledTimes(2);
  });

  it('does not refresh or invent an audit receipt for a no-change retry', async () => {
    mockedAdminPostOrThrow.mockResolvedValueOnce({
      auditId: null,
      canonicalTarget: 'marketing_spend_daily:google:android:all:all:2026-06-20',
      status: 'NO_CHANGE',
    });

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, validSpendFormData());

    expect(result).toMatchObject({
      saved: { auditId: null, outcome: 'NO_CHANGE' },
      status: 'success',
    });
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it.each([
    ['MARKETING_SPEND_FUTURE_DATE', 'invalid'],
    ['MARKETING_SPEND_VERSION_CONFLICT', 'conflict'],
    ['MARKETING_SPEND_CAMPAIGN_ID_AMBIGUOUS', 'conflict'],
  ] as const)('maps typed API code %s to %s without refreshing', async (code, status) => {
    mockedAdminPostOrThrow.mockRejectedValueOnce(
      new AdminApiRequestError('POST', '/admin/marketing/spend-daily', 400, { code }),
    );

    const result = await upsertMarketingSpendDaily({ status: 'idle' }, validSpendFormData());

    expect(result.status).toBe(status);
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

function validSpendFormData() {
  const formData = new FormData();
  formData.set('spendDate', '2026-06-20');
  formData.set('source', 'google');
  formData.set('platform', 'android');
  formData.set('spendAmount', '600000');
  formData.set('reason', 'correct invoice total');
  return formData;
}

import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import { upsertMarketingSpendDaily } from './actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('../../lib/admin-api', () => ({
  adminPost: jest.fn(),
}));

const mockedAdminPost = jest.mocked(adminPost);
const mockedRevalidatePath = jest.mocked(revalidatePath);

describe('marketing analytics server actions', () => {
  beforeEach(() => {
    mockedAdminPost.mockResolvedValue(undefined);
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
    formData.set('notes', ' manual import ');

    await upsertMarketingSpendDaily(formData);

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/marketing/spend-daily',
      {
        spendDate: '2026-06-20',
        source: 'google',
        platform: 'android',
        regionCode: 'hcm',
        campaignId: 'launch-hcm',
        campaignName: 'Launch HCMC',
        spendAmount: 600000,
        currency: 'vnd',
        notes: 'manual import',
      },
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/marketing-analytics',
      '/audit-log',
    ]);
  });

  it('skips the API when required spend fields are missing', async () => {
    const formData = new FormData();
    formData.set('source', 'google');

    await upsertMarketingSpendDaily(formData);

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });
});

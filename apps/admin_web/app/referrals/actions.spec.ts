import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import { releaseAvailableReferralRewards } from './actions';

jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('../../lib/admin-api', () => ({
  adminPost: jest.fn(),
  adminPatch: jest.fn(),
}));

const mockedAdminPost = jest.mocked(adminPost);
const mockedRevalidatePath = jest.mocked(revalidatePath);

describe('referral server actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('releases hold-window referral rewards and refreshes referral admin views', async () => {
    mockedAdminPost.mockResolvedValue({ releasedCount: 2 });

    await expect(releaseAvailableReferralRewards()).resolves.toBeUndefined();

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/release-available',
      {},
      { releasedCount: 0 },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/partners',
      '/audit-log',
    ]);
  });
});

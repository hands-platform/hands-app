import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { adminPost } from '../../lib/admin-api';
import {
  creditReferralReward,
  holdReferralReward,
  releaseAvailableReferralRewards,
  reverseReferralReward,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('../../lib/admin-api', () => ({
  adminPost: vi.fn(),
  adminPatch: vi.fn(),
}));

const mockedAdminPost = vi.mocked(adminPost);
const mockedRevalidatePath = vi.mocked(revalidatePath);

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

  it('holds a referral reward candidate and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({ id: 'reward-1', status: 'HELD' });
    const formData = new FormData();
    formData.set('rewardId', 'reward-1');
    formData.set('audience', 'customer');
    formData.set('parentId', 'parent-customer');
    formData.set('reason', ' suspicious signup pattern ');

    await expect(holdReferralReward(formData)).resolves.toBeUndefined();

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/hold',
      { reason: 'suspicious signup pattern' },
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/customers/parent-customer',
      '/audit-log',
    ]);
  });

  it('reverses a referral reward candidate and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({ id: 'reward-1', status: 'REVERSED' });
    const formData = new FormData();
    formData.set('rewardId', 'reward-1');
    formData.set('audience', 'partner');
    formData.set('parentId', 'parent-partner');
    formData.set('reason', 'invalid attribution');

    await expect(reverseReferralReward(formData)).resolves.toBeUndefined();

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/reverse',
      { reason: 'invalid attribution' },
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/partners',
      '/referrals/partners/parent-partner',
      '/audit-log',
    ]);
  });

  it('credits a referral reward candidate and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({
      id: 'reward-1',
      status: 'REWARDED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    const formData = new FormData();
    formData.set('rewardId', 'reward-1');
    formData.set('audience', 'customer');
    formData.set('parentId', 'parent-customer');
    formData.set('reason', 'ready for wallet credit');

    await expect(creditReferralReward(formData)).resolves.toBeUndefined();

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/credit',
      { reason: 'ready for wallet credit' },
      null,
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/customers/parent-customer',
      '/audit-log',
    ]);
  });
});

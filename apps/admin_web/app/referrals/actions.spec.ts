import { vi } from 'vitest';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AdminApiRequestError, adminPatchOrThrow, adminPostOrThrow } from '../../lib/admin-api';
import {
  approveReferralRewardCashout,
  creditReferralReward,
  holdReferralReward,
  markReferralRewardCashoutPaid,
  releaseHeldReferralReward,
  requestReferralCashoutBankCorrection,
  requireReferralRewardTaxReview,
  reverseReferralReward,
  updateReferralPolicy,
} from './actions';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock('../../lib/admin-api', () => ({
  AdminApiRequestError: class AdminApiRequestError extends Error {
    constructor(
      readonly method: string,
      readonly path: string,
      readonly status: number,
      readonly payload?: unknown,
    ) {
      super(`Admin API ${method} ${path} failed with ${status}`);
    }
  },
  adminPostOrThrow: vi.fn(),
  adminPatchOrThrow: vi.fn(),
}));

const mockedAdminPatch = vi.mocked(adminPatchOrThrow);
const mockedAdminPost = vi.mocked(adminPostOrThrow);
const mockedRedirect = vi.mocked(redirect);
const mockedRevalidatePath = vi.mocked(revalidatePath);

describe('referral server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('releases a held reward with state evidence and confirmation', async () => {
    mockedAdminPost.mockResolvedValue({ id: 'reward-1', status: 'AVAILABLE' });
    const formData = referralDecisionForm('customer', 'parent-customer', 'HELD');

    await expect(releaseHeldReferralReward(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith('/admin/referrals/rewards/reward-1/release', {
      expectedStatus: 'HELD',
      expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
      reason: 'review evidence confirmed',
    });
  });

  it('holds a referral reward candidate and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({ id: 'reward-1', status: 'HELD' });
    const formData = referralDecisionForm('customer', 'parent-customer', 'AVAILABLE');
    formData.set('reason', ' suspicious signup pattern ');

    await expect(holdReferralReward(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/hold',
      {
        expectedStatus: 'AVAILABLE',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: 'suspicious signup pattern',
      },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/cashouts',
      '/referrals/customers/parent-customer',
      '/audit-log',
    ]);
  });

  it('reverses a referral reward candidate and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({ id: 'reward-1', status: 'REVERSED' });
    const formData = referralDecisionForm('partner', 'parent-partner', 'HELD');
    formData.set('reason', 'invalid attribution');

    await expect(reverseReferralReward(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/reverse',
      {
        expectedStatus: 'HELD',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: 'invalid attribution',
      },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/partners',
      '/referrals/cashouts',
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
    const formData = referralDecisionForm('customer', 'parent-customer', 'AVAILABLE');
    formData.set('reason', 'ready for wallet credit');

    await expect(creditReferralReward(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/credit',
      {
        expectedStatus: 'AVAILABLE',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: 'ready for wallet credit',
      },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/cashouts',
      '/referrals/customers/parent-customer',
      '/audit-log',
    ]);
  });

  it('blocks an unconfirmed reward decision before calling the API', async () => {
    const formData = referralDecisionForm('customer', 'parent-customer', 'AVAILABLE');
    formData.delete('confirmation');

    await expect(creditReferralReward(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).not.toHaveBeenCalled();
    expect(mockedRedirect).toHaveBeenCalledWith(
      expect.stringContaining('actionCode=validation'),
    );
  });

  it('reports stale reward decisions as conflicts without recording success', async () => {
    mockedAdminPost.mockRejectedValue(
      new AdminApiRequestError('POST', '/admin/referrals/rewards/reward-1/credit', 409),
    );
    const formData = referralDecisionForm('customer', 'parent-customer', 'AVAILABLE');

    await expect(creditReferralReward(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedRedirect).toHaveBeenCalledWith(expect.stringContaining('actionCode=conflict'));
    expect(mockedRevalidatePath).not.toHaveBeenCalled();
  });

  it('approves a referral reward cashout request and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({
      id: 'reward-1',
      status: 'CASHOUT_APPROVED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    const formData = referralDecisionForm('customer', 'parent-customer', 'CASHOUT_REQUESTED');
    formData.set('reason', 'manual cash transfer done');

    await expect(approveReferralRewardCashout(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/cashout-approve',
      {
        expectedStatus: 'CASHOUT_REQUESTED',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: 'manual cash transfer done',
      },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/cashouts',
      '/referrals/customers/parent-customer',
      '/audit-log',
    ]);
  });

  it('marks a referral reward cashout for tax review and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({
      id: 'reward-1',
      status: 'TAX_REVIEW_REQUIRED',
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    const formData = referralDecisionForm('partner', 'parent-partner', 'CASHOUT_REQUESTED');
    formData.set('reason', 'tax details need review');

    await expect(requireReferralRewardTaxReview(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/tax-review',
      {
        expectedStatus: 'CASHOUT_REQUESTED',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: 'tax details need review',
      },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/partners',
      '/referrals/cashouts',
      '/referrals/partners/parent-partner',
      '/audit-log',
    ]);
  });

  it('marks an approved referral reward cashout as paid and refreshes referral detail views', async () => {
    mockedAdminPost.mockResolvedValue({
      id: 'reward-1',
      status: 'PAID',
      walletLedgerReference: 'customer-cashout-ledger-1',
    });
    const formData = referralDecisionForm('customer', 'parent-customer', 'CASHOUT_APPROVED');
    formData.set('approvalAdminId', 'browser-supplied-admin');
    formData.set('reason', 'manual bank transfer complete');
    formData.set('transferRef', 'VCB-REF-001');

    await expect(markReferralRewardCashoutPaid(formData)).rejects.toThrow('NEXT_REDIRECT:');

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/referrals/rewards/reward-1/cashout-paid',
      {
        expectedStatus: 'CASHOUT_APPROVED',
        expectedUpdatedAt: '2026-08-10T10:00:00.000Z',
        reason: 'manual bank transfer complete',
        transferRef: 'VCB-REF-001',
      },
    );
    expect(mockedAdminPost.mock.calls[0]?.[1]).not.toHaveProperty('approvalAdminId');
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/customers',
      '/referrals/cashouts',
      '/referrals/customers/parent-customer',
      '/audit-log',
    ]);
  });

  it('requests a partner bank correction for a referral cashout through the partner bank review API', async () => {
    mockedAdminPost.mockResolvedValue({
      id: 'bank-1',
      status: 'REJECTED',
      rejectionReason: 'The payout bank details are inaccurate, so the deposit cannot be completed.',
    });
    const formData = new FormData();
    formData.set('audience', 'partner');
    formData.set('bankAccountId', 'bank-1');
    formData.set('parentId', 'parent-partner');
    formData.set('reason', ' The payout bank details are inaccurate, so the deposit cannot be completed. ');

    await expect(requestReferralCashoutBankCorrection(formData)).resolves.toBeUndefined();

    expect(mockedAdminPost).toHaveBeenCalledWith(
      '/admin/partner-bank-accounts/bank-1/reject',
      { reason: 'The payout bank details are inaccurate, so the deposit cannot be completed.' },
    );
    expect(mockedRevalidatePath.mock.calls.map(([path]) => path)).toEqual([
      '/referrals/partners',
      '/referrals/cashouts',
      '/referrals/partners/parent-partner',
      '/partners/parent-partner',
      '/audit-log',
    ]);
  });

  it('saves referral platform fee VAT rate with policy updates', async () => {
    mockedAdminPatch.mockResolvedValue({ audience: 'CUSTOMER' });
    const formData = new FormData();
    formData.set('audience', 'customer');
    formData.set('enabledState', 'on');
    formData.set('commissionPercent', '30');
    formData.set('platformFeeVatRate', '9');
    formData.set('holdPeriodDays', '7');
    formData.set('currency', 'VND');
    formData.set('reason', 'sync accounting vat rate');
    formData.set('confirmation', 'confirmed');
    formData.set('expectedUpdatedAt', '2026-06-24T10:00:00.000Z');
    formData.set('returnTo', '/referrals/customers?settings=policy');

    await expect(updateReferralPolicy(formData)).rejects.toThrow(
      'NEXT_REDIRECT:/referrals/customers?settings=policy&status=saved&reason=policy-updated',
    );

    expect(mockedAdminPatch).toHaveBeenCalledWith(
      '/admin/referrals/policies/customer',
      expect.objectContaining({
        commissionPercentBps: 3_000,
        platformFeeVatRateBps: 900,
        expectedUpdatedAt: '2026-06-24T10:00:00.000Z',
        reason: 'sync accounting vat rate',
      }),
    );
    expect(mockedRedirect).toHaveBeenCalledWith(
      '/referrals/customers?settings=policy&status=saved&reason=policy-updated',
    );
  });
});

function referralDecisionForm(
  audience: 'customer' | 'partner',
  parentId: string,
  expectedStatus: string,
) {
  const formData = new FormData();
  formData.set('rewardId', 'reward-1');
  formData.set('audience', audience);
  formData.set('parentId', parentId);
  formData.set('reason', 'review evidence confirmed');
  formData.set('confirmation', 'confirmed');
  formData.set('expectedStatus', expectedStatus);
  formData.set('expectedUpdatedAt', '2026-08-10T10:00:00.000Z');
  return formData;
}

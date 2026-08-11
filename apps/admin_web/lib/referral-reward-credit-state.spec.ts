import type { AdminReferralReward } from './admin-api';
import { referralRewardCreditState, referralRewardDecisionLabel } from './referral-reward-credit-state';

const baseReward: AdminReferralReward = {
  id: 'reward-1',
  amount: 25000,
  availableAt: '2026-06-24T10:00:00.000Z',
  createdAt: '2026-06-24T10:00:00.000Z',
  currency: 'VND',
  qualifyingBookingId: 'booking-1',
  status: 'PENDING',
  updatedAt: '2026-06-24T10:00:00.000Z',
  walletLedgerReference: null,
};

describe('referralRewardCreditState', () => {
  it('treats a wallet ledger reference as already credited', () => {
    expect(
      referralRewardCreditState({
        ...baseReward,
        status: 'AVAILABLE',
        walletLedgerReference: 'wallet-ledger-1',
      }),
    ).toMatchObject({
      helper: 'wallet-ledger-1',
      label: 'Credited',
      tone: 'success',
    });
  });

  it('keeps available rewards distinct from actual wallet credit', () => {
    expect(referralRewardCreditState({ ...baseReward, status: 'AVAILABLE' })).toMatchObject({
      helper: 'Ready for wallet credit; no wallet credit record exists yet.',
      label: 'Ready for credit',
      tone: 'info',
    });
  });

  it('shows pending and held rewards as blocked before credit', () => {
    expect(referralRewardCreditState(baseReward)).toMatchObject({
      helper: 'Waiting for hold period, booking, or policy checks.',
      label: 'Pending checks',
      tone: 'warning',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'HELD' })).toMatchObject({
      helper: 'Held for admin or fraud review before wallet credit.',
      label: 'Held',
      tone: 'warning',
    });
  });

  it('maps referral accounting lifecycle statuses to operator-readable states', () => {
    expect(referralRewardCreditState({ ...baseReward, status: 'APPROVED' })).toMatchObject({
      label: 'Approved',
      tone: 'info',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'LOCKED' })).toMatchObject({
      label: 'Locked',
      tone: 'warning',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'CREDITED' })).toMatchObject({
      label: 'Credited',
      tone: 'success',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'USED_FOR_SERVICE' })).toMatchObject({
      label: 'Used for service',
      tone: 'success',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'OFFSET' })).toMatchObject({
      label: 'Offset',
      tone: 'success',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'CASHOUT_REQUESTED' })).toMatchObject({
      label: 'Cashout requested',
      tone: 'warning',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'CASHOUT_APPROVED' })).toMatchObject({
      label: 'Cashout approved',
      tone: 'info',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'PAID' })).toMatchObject({
      label: 'Paid',
      tone: 'success',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'TAX_REVIEW_REQUIRED' })).toMatchObject({
      label: 'Tax review required',
      tone: 'warning',
    });
  });

  it('marks reversed or cancelled rewards as not payable', () => {
    expect(referralRewardCreditState({ ...baseReward, status: 'REVERSED' })).toMatchObject({
      label: 'Not payable',
      tone: 'danger',
    });
    expect(referralRewardCreditState({ ...baseReward, status: 'CANCELLED' })).toMatchObject({
      label: 'Not payable',
      tone: 'danger',
    });
  });

  it('labels referral cashout and tax review decisions for operators', () => {
    expect(referralRewardDecisionLabel('referral_reward.cashout_approve')).toBe('Approve cashout');
    expect(referralRewardDecisionLabel('referral_reward.cashout_paid')).toBe('Mark paid');
    expect(referralRewardDecisionLabel('referral_reward.tax_review_required')).toBe('Require tax review');
  });
});

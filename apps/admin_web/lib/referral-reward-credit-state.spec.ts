import type { AdminReferralReward } from './admin-api';
import { referralRewardCreditState } from './referral-reward-credit-state';

const baseReward: AdminReferralReward = {
  id: 'reward-1',
  amount: 25000,
  availableAt: '2026-06-24T10:00:00.000Z',
  createdAt: '2026-06-24T10:00:00.000Z',
  currency: 'VND',
  qualifyingBookingId: 'booking-1',
  status: 'PENDING',
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
      helper: 'Ready for wallet credit; no wallet ledger exists yet.',
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
});

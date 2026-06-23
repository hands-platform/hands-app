import type { StatusBadgeTone } from '../components/status-badge';
import type { AdminReferralReward } from './admin-api';

export type ReferralRewardCreditState = {
  readonly helper: string;
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

export function referralRewardCreditState(reward: AdminReferralReward): ReferralRewardCreditState {
  if (reward.walletLedgerReference) {
    return {
      helper: reward.walletLedgerReference,
      label: 'Credited',
      tone: 'success',
    };
  }

  if (reward.status === 'AVAILABLE') {
    return {
      helper: 'Ready for wallet credit; no wallet ledger exists yet.',
      label: 'Ready for credit',
      tone: 'info',
    };
  }

  if (reward.status === 'HELD') {
    return {
      helper: 'Held for admin or fraud review before wallet credit.',
      label: 'Held',
      tone: 'warning',
    };
  }

  if (reward.status === 'REVERSED' || reward.status === 'CANCELLED') {
    return {
      helper: 'Reward is closed and should not be credited.',
      label: 'Not payable',
      tone: 'danger',
    };
  }

  return {
    helper: 'Waiting for hold period, booking, or policy checks.',
    label: 'Pending checks',
    tone: 'warning',
  };
}

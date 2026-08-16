import type { StatusBadgeTone } from '../components/status-badge';
import type { AdminReferralReward } from './admin-api';

export type ReferralRewardCreditState = {
  readonly helper: string;
  readonly label: string;
  readonly tone: StatusBadgeTone;
};

const creditedReferralRewardStatuses = new Set<AdminReferralReward['status']>([
  'REWARDED',
  'CREDITED',
  'USED_FOR_SERVICE',
  'OFFSET',
  'PAID',
]);

const blockedReferralRewardStatuses = new Set<AdminReferralReward['status']>([
  'CASHOUT_REQUESTED',
  'HELD',
  'LOCKED',
  'TAX_REVIEW_REQUIRED',
]);

const closedReferralRewardStatuses = new Set<AdminReferralReward['status']>(['CANCELLED', 'REVERSED']);

export function isReferralRewardCredited(reward: Pick<AdminReferralReward, 'status' | 'walletLedgerReference'>) {
  return Boolean(reward.walletLedgerReference) || creditedReferralRewardStatuses.has(reward.status);
}

export function isReferralRewardBlocked(status: AdminReferralReward['status']) {
  return blockedReferralRewardStatuses.has(status);
}

export function isReferralRewardClosed(status: AdminReferralReward['status']) {
  return closedReferralRewardStatuses.has(status);
}

export function referralRewardCreditState(reward: AdminReferralReward): ReferralRewardCreditState {
  if (reward.walletLedgerReference && !isReferralRewardCashoutLifecycleStatus(reward.status)) {
    return {
      helper: reward.walletLedgerReference,
      label: 'Credited',
      tone: 'success',
    };
  }

  if (reward.status === 'APPROVED') {
    return {
      helper: 'Approved for referral wallet processing.',
      label: 'Approved',
      tone: 'info',
    };
  }

  if (reward.status === 'AVAILABLE') {
    return {
      helper: 'Ready for wallet credit; no wallet credit record exists yet.',
      label: 'Ready for credit',
      tone: 'info',
    };
  }

  if (reward.status === 'LOCKED') {
    return {
      helper: 'Locked until the configured referral hold window clears.',
      label: 'Locked',
      tone: 'warning',
    };
  }

  if (reward.status === 'CREDITED') {
    return {
      helper: 'Referral reward has been credited to wallet liability.',
      label: 'Credited',
      tone: 'success',
    };
  }

  if (reward.status === 'USED_FOR_SERVICE') {
    return {
      helper: 'Customer referral wallet was applied to service payment.',
      label: 'Used for service',
      tone: 'success',
    };
  }

  if (reward.status === 'OFFSET') {
    return {
      helper: 'Partner referral wallet was offset against payable or receivable balances.',
      label: 'Offset',
      tone: 'success',
    };
  }

  if (reward.status === 'CASHOUT_REQUESTED') {
    return {
      helper: 'Cashout requested and waiting for admin approval or tax review.',
      label: 'Cashout requested',
      tone: 'warning',
    };
  }

  if (reward.status === 'CASHOUT_APPROVED') {
    return {
      helper: 'Cashout approved and waiting for payout posting.',
      label: 'Cashout approved',
      tone: 'info',
    };
  }

  if (reward.status === 'PAID') {
    return {
      helper: 'Cashout has been paid.',
      label: 'Paid',
      tone: 'success',
    };
  }

  if (reward.status === 'TAX_REVIEW_REQUIRED') {
    return {
      helper: 'Tax review is required before this reward can move further.',
      label: 'Tax review required',
      tone: 'warning',
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

function isReferralRewardCashoutLifecycleStatus(status: AdminReferralReward['status']) {
  return (
    status === 'CASHOUT_REQUESTED' ||
    status === 'CASHOUT_APPROVED' ||
    status === 'PAID' ||
    status === 'TAX_REVIEW_REQUIRED'
  );
}

export function referralRewardDecisionLabel(action: string) {
  if (action === 'referral_reward.credit') {
    return 'Wallet credit posted';
  }
  if (action === 'referral_reward.hold') {
    return 'Hold placed';
  }
  if (action === 'referral_reward.reverse') {
    return 'Reward reversed';
  }
  if (action === 'referral_reward.cashout_approve') {
    return 'Approve cashout';
  }
  if (action === 'referral_reward.cashout_paid') {
    return 'Mark paid';
  }
  if (action === 'referral_reward.tax_review_required') {
    return 'Require tax review';
  }
  if (action === 'referral_reward.release_hold') {
    return 'Hold released';
  }
  return action;
}

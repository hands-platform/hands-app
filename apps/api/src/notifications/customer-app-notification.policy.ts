import { Prisma } from '@prisma/client';

export const CUSTOMER_APP_NOTIFICATION_TYPE = {
  adminPush: 'admin.push.broadcast',
  referralRewardCredit: 'customer.referral.reward_credited',
  walletAdjustment: 'customer.wallet.manual_adjustment',
} as const;

export const CUSTOMER_APP_NOTIFICATION_TYPES = Object.values(CUSTOMER_APP_NOTIFICATION_TYPE);

export function customerAppNotificationWhere(userId?: string): Prisma.NotificationWhereInput {
  return {
    ...(userId ? { userId } : {}),
    type: { in: [...CUSTOMER_APP_NOTIFICATION_TYPES] },
  };
}

export function customerReferralRewardNotification(input: {
  amount: number;
  bookingId: string | null;
  currency: string;
  ledgerId: string;
  rewardId: string;
}) {
  return {
    type: CUSTOMER_APP_NOTIFICATION_TYPE.referralRewardCredit,
    title: 'Referral reward added',
    body: `${formatMoney(input.amount, input.currency)} referral reward was added to your HANDS wallet.`,
    data: {
      amount: input.amount,
      appDestination: 'notificationCenter',
      bookingId: input.bookingId,
      currency: input.currency,
      ledgerId: input.ledgerId,
      referralRewardId: input.rewardId,
      source: 'customer_referral_reward_credit',
    },
  } as const;
}

export function customerWalletAdjustmentNotification(input: {
  afterBalance: number;
  amount: number;
  currency: string;
  direction: 'CREDIT' | 'DEBIT';
  ledgerId: string;
  requestId: string;
}) {
  const movement = input.direction === 'CREDIT' ? 'added to' : 'deducted from';
  return {
    type: CUSTOMER_APP_NOTIFICATION_TYPE.walletAdjustment,
    title: input.direction === 'CREDIT' ? 'Wallet credited' : 'Wallet debited',
    body: `${formatMoney(input.amount, input.currency)} was ${movement} your HANDS wallet.`,
    data: {
      afterBalance: input.afterBalance,
      amount: input.amount,
      appDestination: 'notificationCenter',
      currency: input.currency,
      direction: input.direction,
      ledgerId: input.ledgerId,
      requestId: input.requestId,
      source: 'admin_manual_wallet_adjustment',
    },
  } as const;
}

function formatMoney(amount: number, currency: string) {
  return `${new Intl.NumberFormat('en-US').format(amount)} ${currency}`;
}

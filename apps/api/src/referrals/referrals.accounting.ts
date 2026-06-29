import { calculatePlatformFeeBreakdown } from '../earnings/earnings.policy';

export type CustomerReferralRewardInput = {
  readonly platformFeeGross: number;
  readonly platformFeeVatRateBps: number;
  readonly referralRateBps: number;
};

export type PartnerReferralWalletOffsetPlanInput = {
  readonly negativeWalletAmount: number;
  readonly partnerTaxPayable: number;
  readonly platformFeeGross: number;
  readonly referralWalletAmount: number;
};

export function calculateCustomerReferralReward({
  platformFeeGross,
  platformFeeVatRateBps,
  referralRateBps,
}: CustomerReferralRewardInput) {
  const platformFee = calculatePlatformFeeBreakdown(platformFeeGross, platformFeeVatRateBps);
  const rateBps = nonNegativeWholeVnd(referralRateBps, 'Referral rate bps');
  const rewardGross = Math.round((platformFee.platformFeeNetRevenue * rateBps) / 10_000);

  return {
    ...platformFee,
    referralRateSnapshotBps: rateBps,
    rewardGross,
  };
}

export function calculatePartnerReferralWalletOffsetPlan({
  negativeWalletAmount,
  partnerTaxPayable,
  platformFeeGross,
  referralWalletAmount,
}: PartnerReferralWalletOffsetPlanInput) {
  let remainingWallet = nonNegativeWholeVnd(referralWalletAmount, 'Referral wallet amount');
  const offsetPlatformFee = consumeWallet(remainingWallet, nonNegativeWholeVnd(platformFeeGross, 'Platform fee gross'));
  remainingWallet -= offsetPlatformFee;
  const offsetPartnerTax = consumeWallet(remainingWallet, nonNegativeWholeVnd(partnerTaxPayable, 'Partner tax payable'));
  remainingWallet -= offsetPartnerTax;
  const offsetNegativeWallet = consumeWallet(
    remainingWallet,
    nonNegativeWholeVnd(negativeWalletAmount, 'Negative wallet amount'),
  );
  remainingWallet -= offsetNegativeWallet;

  return {
    offsetNegativeWallet,
    offsetPartnerTax,
    offsetPlatformFee,
    remainingWallet,
    totalOffset: offsetPlatformFee + offsetPartnerTax + offsetNegativeWallet,
  };
}

function consumeWallet(remainingWallet: number, dueAmount: number) {
  return Math.min(remainingWallet, dueAmount);
}

function nonNegativeWholeVnd(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole VND amount`);
  }

  return value;
}

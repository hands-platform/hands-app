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

export type ReferralAccountingAudience = 'CUSTOMER' | 'PARTNER';

export type ReferralTaxPolicy =
  | 'NONE'
  | 'CUSTOMER_SERVICE_CREDIT_ONLY'
  | 'INDIVIDUAL_COMMISSION_PIT_10'
  | 'BUSINESS_SERVICE_VAT5_PIT2'
  | 'NON_RESIDENT_MANUAL_REVIEW'
  | 'MANUAL_REVIEW';

export type ReferralManualReviewFlagCode =
  | 'CUSTOMER_CASHOUT_TAX_REVIEW'
  | 'EXPLICIT_TAX_POLICY_MANUAL_REVIEW'
  | 'HIGH_MONTHLY_REWARD_AMOUNT'
  | 'NON_RESIDENT_MANUAL_REVIEW'
  | 'REPEATED_REFERRAL_ACTIVITY';

export type ReferralManualReviewFlag = {
  readonly code: ReferralManualReviewFlagCode;
  readonly label: string;
  readonly severity: 'tax' | 'risk';
};

export type ReferralManualReviewFlagInput = {
  readonly audience: ReferralAccountingAudience;
  readonly highMonthlyRewardThreshold: number;
  readonly monthlyGrossRewardAmount: number;
  readonly monthlyQualifiedReferralCount: number;
  readonly repeatedReferralThreshold: number;
  readonly requestedCashout: boolean;
  readonly residencyCountryCode?: string | null;
  readonly taxPolicy: ReferralTaxPolicy;
};

export type ReferralTaxWithholdingInput = {
  readonly grossRewardAmount: number;
  readonly taxPolicy: ReferralTaxPolicy;
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

export function calculateReferralTaxWithholding({ grossRewardAmount, taxPolicy }: ReferralTaxWithholdingInput) {
  const gross = nonNegativeWholeVnd(grossRewardAmount, 'Gross referral reward amount');
  const manualReviewRequired = taxPolicy === 'MANUAL_REVIEW' || taxPolicy === 'NON_RESIDENT_MANUAL_REVIEW';
  const vatWithheldAmount = taxPolicy === 'BUSINESS_SERVICE_VAT5_PIT2' ? bpsAmount(gross, 500) : 0;
  const pitWithheldAmount =
    taxPolicy === 'INDIVIDUAL_COMMISSION_PIT_10'
      ? bpsAmount(gross, 1_000)
      : taxPolicy === 'BUSINESS_SERVICE_VAT5_PIT2'
        ? bpsAmount(gross, 200)
        : 0;
  const totalWithheldAmount = vatWithheldAmount + pitWithheldAmount;

  return {
    grossRewardAmount: gross,
    manualReviewRequired,
    netWalletAmount: gross - totalWithheldAmount,
    pitWithheldAmount,
    taxPolicySnapshot: taxPolicy,
    totalWithheldAmount,
    vatWithheldAmount,
  };
}

export function buildReferralManualReviewFlags(input: ReferralManualReviewFlagInput) {
  const flags: ReferralManualReviewFlag[] = [];
  const countryCode = input.residencyCountryCode?.trim().toUpperCase();
  const monthlyGrossRewardAmount = nonNegativeWholeVnd(input.monthlyGrossRewardAmount, 'Monthly gross reward amount');
  const highMonthlyRewardThreshold = nonNegativeWholeVnd(
    input.highMonthlyRewardThreshold,
    'High monthly reward threshold',
  );
  const monthlyQualifiedReferralCount = nonNegativeWholeVnd(
    input.monthlyQualifiedReferralCount,
    'Monthly qualified referral count',
  );
  const repeatedReferralThreshold = nonNegativeWholeVnd(input.repeatedReferralThreshold, 'Repeated referral threshold');

  if (input.audience === 'CUSTOMER' && input.requestedCashout) {
    flags.push({
      code: 'CUSTOMER_CASHOUT_TAX_REVIEW',
      label: 'Customer referral cashout requires admin approval and tax review.',
      severity: 'tax',
    });
  }

  if (input.taxPolicy === 'MANUAL_REVIEW' || input.taxPolicy === 'NON_RESIDENT_MANUAL_REVIEW') {
    flags.push({
      code: 'EXPLICIT_TAX_POLICY_MANUAL_REVIEW',
      label: 'Configured referral tax policy requires manual accounting review.',
      severity: 'tax',
    });
  }

  if (countryCode && countryCode !== 'VN') {
    flags.push({
      code: 'NON_RESIDENT_MANUAL_REVIEW',
      label: 'Referral recipient is outside Vietnam residency scope and needs manual review.',
      severity: 'tax',
    });
  }

  if (highMonthlyRewardThreshold > 0 && monthlyGrossRewardAmount >= highMonthlyRewardThreshold) {
    flags.push({
      code: 'HIGH_MONTHLY_REWARD_AMOUNT',
      label: 'Monthly referral reward amount reached the configured high-value review threshold.',
      severity: 'risk',
    });
  }

  if (repeatedReferralThreshold > 0 && monthlyQualifiedReferralCount >= repeatedReferralThreshold) {
    flags.push({
      code: 'REPEATED_REFERRAL_ACTIVITY',
      label: 'Repeated monthly referral activity reached the configured fraud/risk review threshold.',
      severity: 'risk',
    });
  }

  return flags;
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

function bpsAmount(amount: number, bps: number) {
  return Math.round((amount * bps) / 10_000);
}

function nonNegativeWholeVnd(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative whole VND amount`);
  }

  return value;
}

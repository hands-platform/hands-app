import {
  BookingSettlementStatus,
  BookingStatus,
  PaymentStatus,
  type Prisma,
  ReferralAttributionStatus,
  ReferralFraudReviewStatus,
  ReferralRewardMode,
} from '@prisma/client';

export type ReferralRewardEvidenceBlockerCode =
  | 'ATTRIBUTION_NOT_QUALIFIED'
  | 'CALCULATION_SNAPSHOT_INVALID'
  | 'INTEGRITY_REVIEW_REQUIRED'
  | 'PAYMENT_EVIDENCE_MISSING'
  | 'QUALIFYING_BOOKING_MISSING'
  | 'QUALIFYING_BOOKING_NOT_ELIGIBLE'
  | 'QUALIFYING_BOOKING_REFUNDED'
  | 'REWARD_HOLD_NOT_MATURED'
  | 'REWARD_WALLET_OWNER_INVALID'
  | 'SETTLEMENT_EVIDENCE_MISSING'
  | 'WALLET_LEDGER_ALREADY_POSTED';

export type ReferralRewardEvidenceBlocker = {
  code: ReferralRewardEvidenceBlockerCode;
  message: string;
};

export type ReferralRewardEvidenceCandidate = {
  amount: number;
  availableAt?: Date | null;
  calculationSnapshot?: Prisma.JsonValue;
  qualifyingBookingId?: string | null;
  walletLedgerReference?: string | null;
  walletOwnerCustomerProfileId?: string | null;
  walletOwnerProviderProfileId?: string | null;
  attribution?: {
    audience: string;
    fraudReviewStatus: string;
    referrerCustomerProfileId: string | null;
    referrerProviderProfileId: string | null;
    status: string;
  };
  qualifyingBooking?: {
    customerProfileId: string;
    earning: { id: string } | null;
    id: string;
    payment: { method: string; status: string } | null;
    refunds: Array<{ status: string }>;
    selectedProviderId: string | null;
    settlementSnapshot: {
      customerProfileId: string;
      providerProfileId: string;
      reversedById: string | null;
      settlementStatus: string;
    } | null;
    status: string;
  } | null;
};

export function referralRewardEvidenceBlocker(
  reward: ReferralRewardEvidenceCandidate,
  referenceDate = new Date(),
): ReferralRewardEvidenceBlocker | null {
  if (reward.walletLedgerReference) {
    return blocker('WALLET_LEDGER_ALREADY_POSTED', 'The reward already has a wallet ledger entry.');
  }
  if (!reward.attribution || reward.attribution.status !== ReferralAttributionStatus.QUALIFIED) {
    return blocker('ATTRIBUTION_NOT_QUALIFIED', 'The referral attribution is not qualified.');
  }
  if (reward.attribution.fraudReviewStatus !== ReferralFraudReviewStatus.CLEAR) {
    return blocker('INTEGRITY_REVIEW_REQUIRED', 'Referral integrity review must be clear.');
  }

  const expectedWalletOwner =
    reward.attribution.audience === 'CUSTOMER'
      ? reward.attribution.referrerCustomerProfileId
      : reward.attribution.referrerProviderProfileId;
  const actualWalletOwner = reward.walletOwnerCustomerProfileId ?? reward.walletOwnerProviderProfileId;
  if (!expectedWalletOwner || expectedWalletOwner !== actualWalletOwner) {
    return blocker('REWARD_WALLET_OWNER_INVALID', 'The reward wallet owner does not match its attribution.');
  }
  if (!reward.qualifyingBookingId || !reward.qualifyingBooking) {
    return blocker('QUALIFYING_BOOKING_MISSING', 'Qualifying booking evidence is missing.');
  }
  if (!reward.availableAt || reward.availableAt.getTime() > referenceDate.getTime()) {
    return blocker('REWARD_HOLD_NOT_MATURED', 'The referral reward hold period has not matured.');
  }

  const booking = reward.qualifyingBooking;
  if (
    booking.id !== reward.qualifyingBookingId ||
    booking.status !== BookingStatus.COMPLETED ||
    !booking.earning ||
    !booking.selectedProviderId
  ) {
    return blocker(
      'QUALIFYING_BOOKING_NOT_ELIGIBLE',
      'The qualifying booking is not completed with settled earning data.',
    );
  }
  if (
    booking.payment &&
    booking.payment.status !== PaymentStatus.CAPTURED &&
    booking.payment.status !== PaymentStatus.RELEASED
  ) {
    return blocker('PAYMENT_EVIDENCE_MISSING', 'The qualifying booking payment is not captured or released.');
  }
  if (booking.refunds.some((refund) => !['REJECTED', 'CANCELLED'].includes(refund.status.toUpperCase()))) {
    return blocker('QUALIFYING_BOOKING_REFUNDED', 'The qualifying booking has an active or completed refund.');
  }
  const settlement = booking.settlementSnapshot;
  if (
    !settlement ||
    settlement.settlementStatus !== BookingSettlementStatus.POSTED ||
    settlement.reversedById ||
    settlement.customerProfileId !== booking.customerProfileId ||
    settlement.providerProfileId !== booking.selectedProviderId
  ) {
    return blocker(
      'SETTLEMENT_EVIDENCE_MISSING',
      'The qualifying booking settlement is missing, reversed, or inconsistent.',
    );
  }
  if (!validReferralRewardCalculationSnapshot(reward)) {
    return blocker('CALCULATION_SNAPSHOT_INVALID', 'The referral reward policy snapshot is missing or inconsistent.');
  }
  return null;
}

function blocker(code: ReferralRewardEvidenceBlockerCode, message: string): ReferralRewardEvidenceBlocker {
  return { code, message };
}

function validReferralRewardCalculationSnapshot(reward: ReferralRewardEvidenceCandidate) {
  const snapshot = reward.calculationSnapshot;
  const attribution = reward.attribution;
  if (!attribution || !snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return false;
  }
  return (
    snapshot.audience === attribution.audience &&
    typeof snapshot.bookingId === 'string' &&
    snapshot.bookingId === reward.qualifyingBookingId &&
    typeof snapshot.rewardAmountSnapshot === 'number' &&
    snapshot.rewardAmountSnapshot === reward.amount &&
    (snapshot.rewardMode === ReferralRewardMode.COMMISSION_PERCENT ||
      snapshot.rewardMode === ReferralRewardMode.FIXED_AMOUNT)
  );
}

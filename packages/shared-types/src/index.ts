export type Role = 'CUSTOMER' | 'PROVIDER' | 'ADMIN';

export type ReferralAudience = 'CUSTOMER' | 'PARTNER';

export type ReferralAudienceSlug = 'customer' | 'partner';

export type ReferralAttributionStatus = 'REGISTERED' | 'QUALIFIED' | 'REWARDED' | 'BLOCKED' | 'CANCELLED';

export type ReferralFraudReviewStatus = 'CLEAR' | 'FLAGGED' | 'HELD';

export type ReferralRewardStatus = 'PENDING' | 'AVAILABLE' | 'REWARDED' | 'HELD' | 'REVERSED' | 'CANCELLED';

export type ReferralCodeSelfService = {
  id: string;
  audience: ReferralAudience;
  code: string;
  active: boolean;
  sharePath: string;
  createdAt: string | Date;
  updatedAt: string | Date;
};

export type ReferralCodeSelfServiceResponse = ReferralCodeSelfService | null;

export type ReferralCodeClaimResult = {
  id: string;
  audience: ReferralAudience;
  referralCodeId: string;
  referrerCustomerProfileId: string | null;
  referrerProviderProfileId: string | null;
  referredCustomerProfileId: string | null;
  referredProviderProfileId: string | null;
  installSource: string | null;
  platform: string | null;
  status: ReferralAttributionStatus;
  fraudReviewStatus: ReferralFraudReviewStatus;
  createdAt: string | Date;
  updatedAt: string | Date;
  referralCode: {
    id: string;
    code: string;
  };
};

export type ReferralSummaryTotals = {
  availableAmount: number;
  cancelledAmount: number;
  currency: string;
  heldAmount: number;
  pendingAmount: number;
  referralCount: number;
  reversedAmount: number;
  rewardCount: number;
};

export type ReferralSummary = {
  referralCode: ReferralCodeSelfServiceResponse;
  totals: ReferralSummaryTotals;
};

export type BookingStatus =
  | 'CREATED'
  | 'OPEN_MATCHING'
  | 'MATCHED'
  | 'PROVIDER_ON_THE_WAY'
  | 'ARRIVED'
  | 'IN_SERVICE'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'EXPIRED'
  | 'REFUNDED';

export type ProviderStatus = 'OFFLINE' | 'ONLINE_AVAILABLE' | 'ONLINE_BUSY' | 'ONLINE_AVAILABLE_SOON';

export const REALTIME_EVENTS = [
  'booking.created',
  'booking.opened',
  'booking.requested',
  'booking.backup_available',
  'provider.joined',
  'provider.accepted',
  'provider.rejected',
  'booking.matched',
  'booking.cancelled',
  'booking.rejected',
  'booking.expired',
  'booking.no_show',
  'provider.arrived',
  'provider.account.blocked',
  'provider.account.unblocked',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
  'provider.location.updated',
  'chat.message.created',
  'service.started',
  'service.completed',
  'earning.created',
  'payment.updated',
] as const;

export type RealtimeEvent = (typeof REALTIME_EVENTS)[number];

export const PARTNER_ALERT_EVENTS = [
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
] as const satisfies readonly RealtimeEvent[];

export type PartnerAlertEvent = (typeof PARTNER_ALERT_EVENTS)[number];

import type {
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralAudienceSlug,
  ReferralCodeClaimResult,
  ReferralCodeSelfService,
  ReferralCodeSelfServiceResponse,
  ReferralFraudReviewStatus,
  ReferralRewardStatus,
  ReferralSummary,
  ReferralSummaryTotals,
} from './index';

const customerAudience: ReferralAudience = 'CUSTOMER';
const customerSlug: ReferralAudienceSlug = 'customer';

const referralCode: ReferralCodeSelfService = {
  id: 'referral-code-1',
  audience: customerAudience,
  code: 'HC2D1B20B37',
  active: true,
  sharePath: `/r/${customerSlug}/HC2D1B20B37`,
  createdAt: '2026-06-24T10:00:00.000Z',
  updatedAt: new Date('2026-06-24T10:00:00.000Z'),
};

const maybeReferralCode: ReferralCodeSelfServiceResponse = referralCode;
const noReferralCodeYet: ReferralCodeSelfServiceResponse = null;

const claimResult: ReferralCodeClaimResult = {
  id: 'attribution-1',
  audience: customerAudience,
  referralCodeId: 'referral-code-1',
  referrerCustomerProfileId: 'customer-referrer-1',
  referrerProviderProfileId: null,
  referredCustomerProfileId: 'customer-referred-1',
  referredProviderProfileId: null,
  installSource: 'referral-link',
  platform: 'android',
  status: 'REGISTERED',
  fraudReviewStatus: 'CLEAR',
  referralCode: { id: 'referral-code-1', code: 'HC2D1B20B37' },
  createdAt: '2026-06-24T10:00:00.000Z',
  updatedAt: new Date('2026-06-24T10:00:00.000Z'),
};

const status: ReferralAttributionStatus = claimResult.status;
const fraudStatus: ReferralFraudReviewStatus = claimResult.fraudReviewStatus;
const rewardStatus: ReferralRewardStatus = 'PENDING';
const rewardedRewardStatus: ReferralRewardStatus = 'REWARDED';

const summaryTotals: ReferralSummaryTotals = {
  availableAmount: 75_000,
  cancelledAmount: 0,
  currency: 'VND',
  heldAmount: 0,
  pendingAmount: 25_000,
  referralCount: 2,
  reversedAmount: 0,
  rewardCount: 2,
};

const summary: ReferralSummary = {
  referralCode: maybeReferralCode,
  totals: summaryTotals,
};

void maybeReferralCode;
void noReferralCodeYet;
void status;
void fraudStatus;
void rewardStatus;
void rewardedRewardStatus;
void summary;

import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  CustomerWalletLedgerType,
  Prisma,
  ProviderWalletLedgerType,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
} from '@prisma/client';
import { calculatePlatformFeeBreakdown } from '../earnings/earnings.policy';
import { PrismaService } from '../prisma/prisma.service';
import { calculateCustomerReferralReward } from './referrals.accounting';

const DEFAULT_REFERRAL_PLATFORM_FEE_VAT_RATE_BPS = 800;
const CREDITED_REFERRAL_REWARD_STATUS = referralRewardStatus('CREDITED');

const referralCodeSelect = {
  id: true,
  active: true,
  audience: true,
  code: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReferralCodeSelect;

type ReferralCodeRecord = Prisma.ReferralCodeGetPayload<{ select: typeof referralCodeSelect }>;

const referralClaimCodeSelect = {
  id: true,
  active: true,
  audience: true,
  code: true,
  ownerCustomerProfileId: true,
  ownerProviderProfileId: true,
} satisfies Prisma.ReferralCodeSelect;

const referralAttributionSelect = {
  id: true,
  audience: true,
  referralCodeId: true,
  referrerCustomerProfileId: true,
  referrerProviderProfileId: true,
  referredCustomerProfileId: true,
  referredProviderProfileId: true,
  installSource: true,
  platform: true,
  status: true,
  fraudReviewStatus: true,
  createdAt: true,
  updatedAt: true,
  referralCode: {
    select: {
      id: true,
      code: true,
    },
  },
} satisfies Prisma.ReferralAttributionSelect;

type ReferralAttributionRecord = Prisma.ReferralAttributionGetPayload<{ select: typeof referralAttributionSelect }>;

const completedBookingReferralSelect = {
  id: true,
  status: true,
  customerProfileId: true,
  selectedProviderId: true,
  updatedAt: true,
  earning: {
    select: {
      id: true,
      grossAmount: true,
      platformFee: true,
      currency: true,
    },
  },
} satisfies Prisma.BookingSelect;

type CompletedBookingReferralRecord = Prisma.BookingGetPayload<{ select: typeof completedBookingReferralSelect }>;
type CompletedBookingReferralWithEarning = CompletedBookingReferralRecord & {
  earning: NonNullable<CompletedBookingReferralRecord['earning']>;
  selectedProviderId: string;
};

const referralPolicySelect = {
  audience: true,
  commissionPercentBps: true,
  currency: true,
  enabled: true,
  fixedRewardAmount: true,
  holdPeriodDays: true,
  maxRewardedReferrals: true,
  maxRewardsPerReferred: true,
  metadata: true,
  perRewardCapAmount: true,
  rewardMode: true,
  totalRewardCapAmount: true,
} satisfies Prisma.ReferralPolicySelect;

type ReferralPolicyRecord = Prisma.ReferralPolicyGetPayload<{ select: typeof referralPolicySelect }>;

const rewardAttributionCandidateSelect = {
  id: true,
  audience: true,
  referrerCustomerProfileId: true,
  referrerProviderProfileId: true,
  referredCustomerProfileId: true,
  referredProviderProfileId: true,
} satisfies Prisma.ReferralAttributionSelect;

type RewardAttributionCandidate = Prisma.ReferralAttributionGetPayload<{
  select: typeof rewardAttributionCandidateSelect;
}>;

const referralRewardSelect = {
  id: true,
  amount: true,
  availableAt: true,
  currency: true,
  sourceKey: true,
  status: true,
  walletLedgerReference: true,
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardRecord = Prisma.ReferralRewardGetPayload<{ select: typeof referralRewardSelect }>;

const referralRewardCreditCandidateSelect = {
  id: true,
  amount: true,
  currency: true,
  qualifyingBookingId: true,
  sourceKey: true,
  status: true,
  walletLedgerReference: true,
  walletOwnerCustomerProfileId: true,
  walletOwnerProviderProfileId: true,
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardCreditCandidate = Prisma.ReferralRewardGetPayload<{
  select: typeof referralRewardCreditCandidateSelect;
}>;

const referralRewardCandidateStateSelect = {
  id: true,
  status: true,
  walletLedgerReference: true,
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardCandidateState = Prisma.ReferralRewardGetPayload<{
  select: typeof referralRewardCandidateStateSelect;
}>;

const HOLDABLE_REWARD_CANDIDATE_STATUSES = new Set<ReferralRewardStatus>([
  ReferralRewardStatus.PENDING,
  ReferralRewardStatus.AVAILABLE,
]);

const REVERSIBLE_REWARD_CANDIDATE_STATUSES = new Set<ReferralRewardStatus>([
  ReferralRewardStatus.PENDING,
  ReferralRewardStatus.AVAILABLE,
  ReferralRewardStatus.HELD,
]);

const REFERRAL_CLAIM_PLATFORMS = new Set(['android', 'ios', 'web']);

type ClaimReferralCodeInput = {
  code: string;
  installSource?: string;
  platform?: string;
};

type ReferralRewardSummaryGroup = {
  status: ReferralRewardStatus;
  currency: string;
  _count: { _all: number };
  _sum: { amount: number | null };
};

@Injectable()
export class ReferralsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCustomerReferralCode(userId: string) {
    const profile = await this.customerProfileForUser(userId);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        audience: ReferralAudience.CUSTOMER,
        ownerCustomerProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return code ? referralCodeView(code) : null;
  }

  async getCustomerReferralSummary(userId: string) {
    const profile = await this.customerProfileForUser(userId);
    const [referralCode, referralCount, rewardGroups] = await Promise.all([
      this.prisma.referralCode.findFirst({
        where: {
          audience: ReferralAudience.CUSTOMER,
          ownerCustomerProfileId: profile.id,
        },
        select: referralCodeSelect,
      }),
      this.prisma.referralAttribution.count({
        where: {
          audience: ReferralAudience.CUSTOMER,
          referrerCustomerProfileId: profile.id,
        },
      }),
      this.prisma.referralReward.groupBy({
        by: ['status', 'currency'],
        where: { walletOwnerCustomerProfileId: profile.id },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      referralCode: referralCode ? referralCodeView(referralCode) : null,
      totals: referralRewardTotals(referralCount, rewardGroups),
    };
  }

  async issueCustomerReferralCode(userId: string) {
    const existing = await this.getCustomerReferralCode(userId);
    if (existing) {
      return existing;
    }

    const profile = await this.customerProfileForUser(userId);
    const code = await this.prisma.referralCode.create({
      data: {
        audience: ReferralAudience.CUSTOMER,
        code: referralCodeForOwner(ReferralAudience.CUSTOMER, profile.id),
        ownerCustomerProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return referralCodeView(code);
  }

  async claimCustomerReferralCode(userId: string, input: ClaimReferralCodeInput) {
    const profile = await this.customerProfileForUser(userId);
    const existing = await this.prisma.referralAttribution.findFirst({
      where: {
        audience: ReferralAudience.CUSTOMER,
        referredCustomerProfileId: profile.id,
      },
      select: referralAttributionSelect,
    });
    if (existing) {
      return referralAttributionView(existing);
    }

    const claim = normalizeReferralClaim(input);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        active: true,
        audience: ReferralAudience.CUSTOMER,
        code: claim.code,
      },
      select: referralClaimCodeSelect,
    });
    if (!code?.ownerCustomerProfileId) {
      throw new BadRequestException('Referral code was not found or is inactive');
    }
    if (code.ownerCustomerProfileId === profile.id) {
      throw new BadRequestException('Customers cannot claim their own referral code');
    }

    const attribution = await this.prisma.referralAttribution.create({
      data: {
        audience: ReferralAudience.CUSTOMER,
        referralCodeId: code.id,
        referrerCustomerProfileId: code.ownerCustomerProfileId,
        referredCustomerProfileId: profile.id,
        installSource: claim.installSource,
        platform: claim.platform,
      },
      select: referralAttributionSelect,
    });

    return referralAttributionView(attribution);
  }

  async getPartnerReferralCode(userId: string) {
    const profile = await this.partnerProfileForUser(userId);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        audience: ReferralAudience.PARTNER,
        ownerProviderProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return code ? referralCodeView(code) : null;
  }

  async getPartnerReferralSummary(userId: string) {
    const profile = await this.partnerProfileForUser(userId);
    const [referralCode, referralCount, rewardGroups] = await Promise.all([
      this.prisma.referralCode.findFirst({
        where: {
          audience: ReferralAudience.PARTNER,
          ownerProviderProfileId: profile.id,
        },
        select: referralCodeSelect,
      }),
      this.prisma.referralAttribution.count({
        where: {
          audience: ReferralAudience.PARTNER,
          referrerProviderProfileId: profile.id,
        },
      }),
      this.prisma.referralReward.groupBy({
        by: ['status', 'currency'],
        where: { walletOwnerProviderProfileId: profile.id },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);

    return {
      referralCode: referralCode ? referralCodeView(referralCode) : null,
      totals: referralRewardTotals(referralCount, rewardGroups),
    };
  }

  async issuePartnerReferralCode(userId: string) {
    const existing = await this.getPartnerReferralCode(userId);
    if (existing) {
      return existing;
    }

    const profile = await this.partnerProfileForUser(userId);
    const code = await this.prisma.referralCode.create({
      data: {
        audience: ReferralAudience.PARTNER,
        code: referralCodeForOwner(ReferralAudience.PARTNER, profile.id),
        ownerProviderProfileId: profile.id,
      },
      select: referralCodeSelect,
    });

    return referralCodeView(code);
  }

  async claimPartnerReferralCode(userId: string, input: ClaimReferralCodeInput) {
    const profile = await this.partnerProfileForUser(userId);
    const existing = await this.prisma.referralAttribution.findFirst({
      where: {
        audience: ReferralAudience.PARTNER,
        referredProviderProfileId: profile.id,
      },
      select: referralAttributionSelect,
    });
    if (existing) {
      return referralAttributionView(existing);
    }

    const claim = normalizeReferralClaim(input);
    const code = await this.prisma.referralCode.findFirst({
      where: {
        active: true,
        audience: ReferralAudience.PARTNER,
        code: claim.code,
      },
      select: referralClaimCodeSelect,
    });
    if (!code?.ownerProviderProfileId) {
      throw new BadRequestException('Referral code was not found or is inactive');
    }
    if (code.ownerProviderProfileId === profile.id) {
      throw new BadRequestException('Partners cannot claim their own referral code');
    }

    const attribution = await this.prisma.referralAttribution.create({
      data: {
        audience: ReferralAudience.PARTNER,
        referralCodeId: code.id,
        referrerProviderProfileId: code.ownerProviderProfileId,
        referredProviderProfileId: profile.id,
        installSource: claim.installSource,
        platform: claim.platform,
      },
      select: referralAttributionSelect,
    });

    return referralAttributionView(attribution);
  }

  async releaseAvailableRewards(referenceDate = new Date()) {
    const result = await this.prisma.referralReward.updateMany({
      data: { status: ReferralRewardStatus.AVAILABLE },
      where: {
        availableAt: { lte: referenceDate },
        status: ReferralRewardStatus.PENDING,
      },
    });

    return { releasedCount: result.count };
  }

  async holdRewardCandidate(rewardId: string) {
    return this.updateRewardCandidateStatus(rewardId, ReferralRewardStatus.HELD);
  }

  async reverseRewardCandidate(rewardId: string) {
    return this.updateRewardCandidateStatus(rewardId, ReferralRewardStatus.REVERSED);
  }

  async creditRewardCandidate(rewardId: string) {
    return this.prisma.$transaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: rewardId },
        select: referralRewardCreditCandidateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertRewardCandidateCanBeCredited(reward);

      const ledgerSourceKey = referralWalletCreditSourceKey(reward.id);
      const ledger = reward.walletOwnerCustomerProfileId
        ? await tx.customerWalletLedgerEntry.upsert({
            where: { sourceKey: ledgerSourceKey },
            update: {},
            create: {
              amount: reward.amount,
              bookingId: reward.qualifyingBookingId,
              currency: reward.currency,
              customerProfileId: reward.walletOwnerCustomerProfileId,
              metadata: referralWalletCreditMetadata(reward, 'CUSTOMER'),
              referralRewardId: reward.id,
              reference: reward.sourceKey,
              sourceKey: ledgerSourceKey,
              type: customerWalletLedgerType('CUSTOMER_REFERRAL_EARNED'),
            },
            select: { id: true },
          })
        : await tx.providerWalletLedgerEntry.upsert({
            where: { sourceKey: ledgerSourceKey },
            update: {},
            create: {
              amount: reward.amount,
              bookingId: reward.qualifyingBookingId,
              currency: reward.currency,
              metadata: referralWalletCreditMetadata(reward, 'PARTNER'),
              providerProfileId: reward.walletOwnerProviderProfileId as string,
              reference: reward.sourceKey,
              sourceKey: ledgerSourceKey,
              type: providerWalletLedgerType('PARTNER_REFERRAL_EARNED'),
            },
            select: { id: true },
          });

      return tx.referralReward.update({
        data: {
          status: CREDITED_REFERRAL_REWARD_STATUS,
          walletLedgerReference: ledger.id,
        },
        where: { id: reward.id },
        select: referralRewardSelect,
      });
    });
  }

  async createRewardsForCompletedBooking(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: completedBookingReferralSelect,
    });
    if (!booking) {
      throw new NotFoundException('Booking was not found');
    }
    if (booking.status !== BookingStatus.COMPLETED || !booking.earning || !booking.selectedProviderId) {
      throw new BadRequestException('Referral rewards require a completed booking with settled earning data');
    }
    const completedBooking = booking as CompletedBookingReferralWithEarning;

    const customerReward = await this.createCustomerRewardForCompletedBooking(completedBooking);
    const partnerReward = await this.createPartnerRewardForCompletedBooking(completedBooking);

    return { customerReward, partnerReward };
  }

  private async customerProfileForUser(userId: string) {
    const profile = await this.prisma.customerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Customer profile was not found');
    }

    return profile;
  }

  private async partnerProfileForUser(userId: string) {
    const profile = await this.prisma.providerProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) {
      throw new NotFoundException('Partner profile was not found');
    }

    return profile;
  }

  private async createCustomerRewardForCompletedBooking(booking: CompletedBookingReferralWithEarning) {
    const [policy, attribution] = await Promise.all([
      this.referralPolicyFor(ReferralAudience.CUSTOMER),
      this.prisma.referralAttribution.findFirst({
        where: {
          audience: ReferralAudience.CUSTOMER,
          referredCustomerProfileId: booking.customerProfileId,
          referrerCustomerProfileId: { not: null },
          status: { in: [ReferralAttributionStatus.REGISTERED, ReferralAttributionStatus.QUALIFIED] },
        },
        select: rewardAttributionCandidateSelect,
      }),
    ]);
    if (!policy || !attribution?.referrerCustomerProfileId) {
      return null;
    }
    if (policy.rewardMode !== ReferralRewardMode.COMMISSION_PERCENT || !policy.commissionPercentBps) {
      return null;
    }
    const [referrerSlotsAvailable, referredSlotsAvailable] = await Promise.all([
      this.referrerRewardSlotsAvailable({
        audience: ReferralAudience.CUSTOMER,
        maxRewardedReferrals: policy.maxRewardedReferrals,
        walletOwnerCustomerProfileId: attribution.referrerCustomerProfileId,
      }),
      this.referredRewardSlotsAvailable({
        attributionId: attribution.id,
        maxRewardsPerReferred: policy.maxRewardsPerReferred,
      }),
    ]);
    if (!referrerSlotsAvailable || !referredSlotsAvailable) {
      return null;
    }

    const customerReferralReward = calculateCustomerReferralReward({
      platformFeeGross: booking.earning.platformFee,
      platformFeeVatRateBps: referralPlatformFeeVatRateBps(policy),
      referralRateBps: policy.commissionPercentBps,
    });
    const amount = await this.rewardAmountAfterLifetimeCap(
      cappedRewardAmount(customerReferralReward.rewardGross, policy.perRewardCapAmount),
      {
        audience: ReferralAudience.CUSTOMER,
        totalRewardCapAmount: policy.totalRewardCapAmount,
        walletOwnerCustomerProfileId: attribution.referrerCustomerProfileId,
      },
    );
    if (amount <= 0) {
      return null;
    }

    return this.createReferralReward({
      amount,
      attribution,
      booking,
      policy,
      sourceKey: referralRewardSourceKey(ReferralAudience.CUSTOMER, attribution.id, booking.id),
      walletOwnerCustomerProfileId: attribution.referrerCustomerProfileId,
    });
  }

  private async createPartnerRewardForCompletedBooking(booking: CompletedBookingReferralWithEarning) {
    const [policy, attribution] = await Promise.all([
      this.referralPolicyFor(ReferralAudience.PARTNER),
      this.prisma.referralAttribution.findFirst({
        where: {
          audience: ReferralAudience.PARTNER,
          referredProviderProfileId: booking.selectedProviderId,
          referrerProviderProfileId: { not: null },
          status: { in: [ReferralAttributionStatus.REGISTERED, ReferralAttributionStatus.QUALIFIED] },
        },
        select: rewardAttributionCandidateSelect,
      }),
    ]);
    if (!policy || !attribution?.referrerProviderProfileId || !attribution.referredProviderProfileId) {
      return null;
    }
    if (policy.rewardMode !== ReferralRewardMode.FIXED_AMOUNT || !policy.fixedRewardAmount) {
      return null;
    }

    const [alreadyCompletedBookings, referrerSlotsAvailable, referredSlotsAvailable] = await Promise.all([
      this.prisma.providerEarning.count({
        where: {
          providerProfileId: attribution.referredProviderProfileId,
          bookingId: { not: booking.id },
          booking: { status: BookingStatus.COMPLETED },
        },
      }),
      this.referrerRewardSlotsAvailable({
        audience: ReferralAudience.PARTNER,
        maxRewardedReferrals: policy.maxRewardedReferrals,
        walletOwnerProviderProfileId: attribution.referrerProviderProfileId,
      }),
      this.referredRewardSlotsAvailable({
        attributionId: attribution.id,
        maxRewardsPerReferred: policy.maxRewardsPerReferred,
      }),
    ]);
    if (alreadyCompletedBookings > 0 || !referrerSlotsAvailable || !referredSlotsAvailable) {
      return null;
    }

    const amount = await this.rewardAmountAfterLifetimeCap(
      cappedRewardAmount(policy.fixedRewardAmount, policy.perRewardCapAmount),
      {
        audience: ReferralAudience.PARTNER,
        totalRewardCapAmount: policy.totalRewardCapAmount,
        walletOwnerProviderProfileId: attribution.referrerProviderProfileId,
      },
    );
    if (amount <= 0) {
      return null;
    }

    return this.createReferralReward({
      amount,
      attribution,
      booking,
      policy,
      sourceKey: referralRewardSourceKey(ReferralAudience.PARTNER, attribution.id, booking.id),
      walletOwnerProviderProfileId: attribution.referrerProviderProfileId,
    });
  }

  private async referralPolicyFor(audience: ReferralAudience) {
    const policy = await this.prisma.referralPolicy.findUnique({
      where: { audience },
      select: referralPolicySelect,
    });

    return policy?.enabled ? policy : null;
  }

  private async referrerRewardSlotsAvailable(input: {
    audience: ReferralAudience;
    maxRewardedReferrals: number | null;
    walletOwnerCustomerProfileId?: string;
    walletOwnerProviderProfileId?: string;
  }) {
    if (!input.maxRewardedReferrals) {
      return true;
    }

    const rewardCount = await this.prisma.referralReward.count({
      where: {
        status: { notIn: [ReferralRewardStatus.CANCELLED, ReferralRewardStatus.REVERSED] },
        walletOwnerCustomerProfileId: input.walletOwnerCustomerProfileId,
        walletOwnerProviderProfileId: input.walletOwnerProviderProfileId,
        attribution: { audience: input.audience },
      },
    });

    return rewardCount < input.maxRewardedReferrals;
  }

  private async referredRewardSlotsAvailable(input: {
    attributionId: string;
    maxRewardsPerReferred: number | null;
  }) {
    if (!input.maxRewardsPerReferred) {
      return true;
    }

    const rewardCount = await this.prisma.referralReward.count({
      where: {
        attributionId: input.attributionId,
        status: { notIn: [ReferralRewardStatus.CANCELLED, ReferralRewardStatus.REVERSED] },
      },
    });

    return rewardCount < input.maxRewardsPerReferred;
  }

  private async rewardAmountAfterLifetimeCap(
    amount: number,
    input: {
      audience: ReferralAudience;
      totalRewardCapAmount: number | null;
      walletOwnerCustomerProfileId?: string;
      walletOwnerProviderProfileId?: string;
    },
  ) {
    if (!input.totalRewardCapAmount) {
      return amount;
    }

    const existingRewards = await this.prisma.referralReward.aggregate({
      where: {
        status: { notIn: [ReferralRewardStatus.CANCELLED, ReferralRewardStatus.REVERSED] },
        walletOwnerCustomerProfileId: input.walletOwnerCustomerProfileId,
        walletOwnerProviderProfileId: input.walletOwnerProviderProfileId,
        attribution: { audience: input.audience },
      },
      _sum: { amount: true },
    });
    const remainingAmount = Math.max(input.totalRewardCapAmount - (existingRewards._sum.amount ?? 0), 0);

    return Math.min(amount, remainingAmount);
  }

  private async createReferralReward(input: {
    amount: number;
    attribution: RewardAttributionCandidate;
    booking: CompletedBookingReferralWithEarning;
    policy: ReferralPolicyRecord;
    sourceKey: string;
    walletOwnerCustomerProfileId?: string;
    walletOwnerProviderProfileId?: string;
  }): Promise<ReferralRewardRecord> {
    const existing = await this.prisma.referralReward.findUnique({
      where: { sourceKey: input.sourceKey },
      select: referralRewardSelect,
    });
    if (existing) {
      return existing;
    }

    const platformFeeBreakdown = referralPlatformFeeBreakdown(input.booking.earning.platformFee, input.policy);

    return this.prisma.referralReward.create({
      data: {
        amount: input.amount,
        attributionId: input.attribution.id,
        availableAt: referralRewardAvailableAt(input.booking.updatedAt, input.policy.holdPeriodDays),
        calculationSnapshot: {
          audience: input.attribution.audience,
          basePlatformFee: input.booking.earning.platformFee,
          bookingId: input.booking.id,
          companyOutputVat: platformFeeBreakdown.companyOutputVat,
          commissionPercentBps: input.policy.commissionPercentBps,
          fixedRewardAmount: input.policy.fixedRewardAmount,
          grossAmount: input.booking.earning.grossAmount,
          maxRewardsPerReferred: input.policy.maxRewardsPerReferred,
          perRewardCapAmount: input.policy.perRewardCapAmount,
          platformFeeNetRevenue: platformFeeBreakdown.platformFeeNetRevenue,
          platformFeeVatRateBps: platformFeeBreakdown.platformFeeVatRateBps,
          rewardAmountSnapshot: input.amount,
          rewardMode: input.policy.rewardMode,
          rewardRateSnapshotBps: input.policy.commissionPercentBps,
          totalRewardCapAmount: input.policy.totalRewardCapAmount,
        },
        currency: input.policy.currency || input.booking.earning.currency,
        qualifyingBookingId: input.booking.id,
        sourceKey: input.sourceKey,
        status: ReferralRewardStatus.PENDING,
        walletOwnerCustomerProfileId: input.walletOwnerCustomerProfileId,
        walletOwnerProviderProfileId: input.walletOwnerProviderProfileId,
      },
      select: referralRewardSelect,
    });
  }

  private async updateRewardCandidateStatus(rewardId: string, status: ReferralRewardStatus) {
    const reward = await this.referralRewardCandidateState(rewardId);
    this.assertRewardCandidateCanChangeStatus(reward, status);

    return this.prisma.referralReward.update({
      data: { status },
      where: { id: rewardId },
      select: referralRewardSelect,
    });
  }

  private async referralRewardCandidateState(rewardId: string) {
    const reward = await this.prisma.referralReward.findUnique({
      where: { id: rewardId },
      select: referralRewardCandidateStateSelect,
    });
    if (!reward) {
      throw new NotFoundException('Referral reward was not found');
    }

    return reward;
  }

  private assertRewardCandidateCanChangeStatus(reward: ReferralRewardCandidateState, nextStatus: ReferralRewardStatus) {
    if (reward.walletLedgerReference) {
      throw new BadRequestException('Credited referral rewards require a wallet reversal flow');
    }

    if (nextStatus === ReferralRewardStatus.HELD) {
      if (!HOLDABLE_REWARD_CANDIDATE_STATUSES.has(reward.status)) {
        throw new BadRequestException('Only pending or available referral reward candidates can be held');
      }
      return;
    }

    if (nextStatus === ReferralRewardStatus.REVERSED) {
      if (!REVERSIBLE_REWARD_CANDIDATE_STATUSES.has(reward.status)) {
        throw new BadRequestException('Only uncredited referral reward candidates can be reversed');
      }
    }
  }

  private assertRewardCandidateCanBeCredited(reward: ReferralRewardCreditCandidate) {
    if (reward.walletLedgerReference) {
      throw new BadRequestException('Referral reward already has a wallet ledger reference');
    }
    if (reward.status !== ReferralRewardStatus.AVAILABLE) {
      throw new BadRequestException('Only available referral rewards can be credited to wallets');
    }
    if (!reward.walletOwnerCustomerProfileId && !reward.walletOwnerProviderProfileId) {
      throw new BadRequestException('Referral reward does not have a wallet owner');
    }
  }
}

function referralCodeView(code: ReferralCodeRecord) {
  const audienceSlug = code.audience === ReferralAudience.PARTNER ? 'partner' : 'customer';

  return {
    ...code,
    sharePath: `/r/${audienceSlug}/${encodeURIComponent(code.code)}`,
  };
}

function referralAttributionView(attribution: ReferralAttributionRecord) {
  return attribution;
}

function referralRewardTotals(referralCount: number, groups: ReferralRewardSummaryGroup[]) {
  const totals = {
    availableAmount: 0,
    cancelledAmount: 0,
    currency: 'VND',
    heldAmount: 0,
    pendingAmount: 0,
    referralCount,
    rewardedAmount: 0,
    reversedAmount: 0,
    rewardCount: 0,
  };

  for (const group of groups) {
    const amount = group._sum.amount ?? 0;
    totals.currency = group.currency || totals.currency;
    totals.rewardCount += group._count._all;
    if (group.status === ReferralRewardStatus.AVAILABLE) {
      totals.availableAmount += amount;
    } else if (group.status === ReferralRewardStatus.CANCELLED) {
      totals.cancelledAmount += amount;
    } else if (group.status === ReferralRewardStatus.HELD) {
      totals.heldAmount += amount;
    } else if (group.status === ReferralRewardStatus.PENDING) {
      totals.pendingAmount += amount;
    } else if (isCreditedReferralRewardStatus(group.status)) {
      totals.rewardedAmount += amount;
    } else if (group.status === ReferralRewardStatus.REVERSED) {
      totals.reversedAmount += amount;
    }
  }

  return totals;
}

function normalizeReferralClaim(input: ClaimReferralCodeInput) {
  const code = normalizeRequiredText(input.code).toUpperCase();

  return {
    code,
    installSource: normalizeOptionalText(input.installSource),
    platform: normalizeReferralPlatform(input.platform),
  };
}

function normalizeRequiredText(value: string) {
  const normalized = normalizeOptionalText(value);
  if (!normalized) {
    throw new BadRequestException('Referral code is required');
  }

  return normalized;
}

function normalizeOptionalText(value: string | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizeReferralPlatform(value: string | undefined) {
  const platform = normalizeOptionalText(value);
  if (platform && !REFERRAL_CLAIM_PLATFORMS.has(platform)) {
    throw new BadRequestException('Referral platform must be android, ios, or web');
  }

  return platform;
}

function referralCodeForOwner(audience: ReferralAudience, ownerProfileId: string) {
  const prefix = audience === ReferralAudience.PARTNER ? 'HP' : 'HC';
  const digest = createHash('sha256')
    .update(`${audience}:${ownerProfileId}`)
    .digest('hex')
    .slice(0, 10)
    .toUpperCase();

  return `${prefix}${digest}`;
}

function cappedRewardAmount(amount: number, capAmount: number | null) {
  if (capAmount && capAmount > 0) {
    return Math.min(amount, capAmount);
  }

  return amount;
}

function referralPlatformFeeBreakdown(platformFeeGross: number, policy: ReferralPolicyRecord) {
  return calculatePlatformFeeBreakdown(platformFeeGross, referralPlatformFeeVatRateBps(policy));
}

function referralPlatformFeeVatRateBps(policy: ReferralPolicyRecord) {
  const configuredVatRateBps = referralMetadataWholeBps(policy.metadata, 'platformFeeVatRateBps');

  return configuredVatRateBps ?? DEFAULT_REFERRAL_PLATFORM_FEE_VAT_RATE_BPS;
}

function customerWalletLedgerType(value: string): CustomerWalletLedgerType {
  return value as CustomerWalletLedgerType;
}

function providerWalletLedgerType(value: string): ProviderWalletLedgerType {
  return value as ProviderWalletLedgerType;
}

function referralRewardStatus(value: string): ReferralRewardStatus {
  return value as ReferralRewardStatus;
}

function isCreditedReferralRewardStatus(status: ReferralRewardStatus) {
  return status === ReferralRewardStatus.REWARDED || status === CREDITED_REFERRAL_REWARD_STATUS;
}

function referralMetadataWholeBps(metadata: Prisma.JsonValue | null, key: string) {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const value = metadata[key];
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 10_000) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 10_000) {
      return parsed;
    }
  }

  return null;
}

function referralRewardAvailableAt(referenceDate: Date, holdPeriodDays: number) {
  return new Date(referenceDate.getTime() + Math.max(holdPeriodDays, 0) * 24 * 60 * 60 * 1000);
}

function referralWalletCreditSourceKey(rewardId: string) {
  return `referral:wallet-credit:${rewardId}`;
}

function referralWalletCreditMetadata(reward: ReferralRewardCreditCandidate, walletOwner: 'CUSTOMER' | 'PARTNER') {
  return {
    bookingId: reward.qualifyingBookingId,
    referralRewardId: reward.id,
    rewardSourceKey: reward.sourceKey,
    walletOwner,
  };
}

function referralRewardSourceKey(audience: ReferralAudience, attributionId: string, bookingId: string) {
  return `referral:${audience}:${attributionId}:${bookingId}`;
}

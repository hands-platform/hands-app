import { createHash } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  Prisma,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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
  perRewardCapAmount: true,
  rewardMode: true,
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
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardRecord = Prisma.ReferralRewardGetPayload<{ select: typeof referralRewardSelect }>;

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
    const rewardSlotsAvailable = await this.referrerRewardSlotsAvailable({
      audience: ReferralAudience.CUSTOMER,
      maxRewardedReferrals: policy.maxRewardedReferrals,
      walletOwnerCustomerProfileId: attribution.referrerCustomerProfileId,
    });
    if (!rewardSlotsAvailable) {
      return null;
    }

    const amount = cappedRewardAmount(
      Math.round((booking.earning.platformFee * policy.commissionPercentBps) / 10_000),
      policy.perRewardCapAmount,
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

    const [alreadyCompletedBookings, rewardSlotsAvailable] = await Promise.all([
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
    ]);
    if (alreadyCompletedBookings > 0 || !rewardSlotsAvailable) {
      return null;
    }

    const amount = cappedRewardAmount(policy.fixedRewardAmount, policy.perRewardCapAmount);
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

    return this.prisma.referralReward.create({
      data: {
        amount: input.amount,
        attributionId: input.attribution.id,
        availableAt: referralRewardAvailableAt(input.booking.updatedAt, input.policy.holdPeriodDays),
        calculationSnapshot: {
          audience: input.attribution.audience,
          basePlatformFee: input.booking.earning.platformFee,
          bookingId: input.booking.id,
          commissionPercentBps: input.policy.commissionPercentBps,
          fixedRewardAmount: input.policy.fixedRewardAmount,
          grossAmount: input.booking.earning.grossAmount,
          perRewardCapAmount: input.policy.perRewardCapAmount,
          rewardMode: input.policy.rewardMode,
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
    platform: normalizeOptionalText(input.platform),
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

function referralRewardAvailableAt(referenceDate: Date, holdPeriodDays: number) {
  return new Date(referenceDate.getTime() + Math.max(holdPeriodDays, 0) * 24 * 60 * 60 * 1000);
}

function referralRewardSourceKey(audience: ReferralAudience, attributionId: string, bookingId: string) {
  return `referral:${audience}:${attributionId}:${bookingId}`;
}

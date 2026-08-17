import { createHash } from 'crypto';
import { BadRequestException, ConflictException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import {
  BookingStatus,
  CustomerWalletLedgerType,
  Prisma,
  ProviderWalletLedgerType,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
  Role,
} from '@prisma/client';
import { calculatePlatformFeeBreakdown } from '../earnings/earnings.policy';
import { customerReferralRewardNotification } from '../notifications/customer-app-notification.policy';
import { notificationDataWithDeliveryContract } from '../notifications/notification-data-scope';
import { notificationDataWithTargetRole } from '../notifications/notification-target-role';
import { toJson } from '../notifications/notification-push-payload';
import { NotificationsService } from '../notifications/notifications.service';
import { customerWalletBookingLockKey } from '../payments/customer-wallet-payment';
import { PrismaService } from '../prisma/prisma.service';
import {
  CUSTOMER_WALLET_LEDGER_REPLAY_FIELDS,
  immutableFinancialReplayMatches,
  PROVIDER_WALLET_LEDGER_REPLAY_FIELDS,
} from '../settlements/immutable-financial-replay';
import {
  calculateCustomerReferralReward,
  calculateReferralTaxWithholding,
  type ReferralTaxPolicy,
} from './referrals.accounting';
import { isReferralRewardFixture, referralAdminFixtureRewardWhere } from './referral-fixture';
import { referralRewardEvidenceBlocker } from './referral-reward-evidence';

const DEFAULT_REFERRAL_PLATFORM_FEE_VAT_RATE_BPS = 800;
const CASHOUT_APPROVED_REFERRAL_REWARD_STATUS = referralRewardStatus('CASHOUT_APPROVED');
const CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS = referralRewardStatus('CASHOUT_REQUESTED');
const CREDITED_REFERRAL_REWARD_STATUS = referralRewardStatus('CREDITED');
const PAID_REFERRAL_REWARD_STATUS = referralRewardStatus('PAID');
const TAX_REVIEW_REQUIRED_REFERRAL_REWARD_STATUS = referralRewardStatus('TAX_REVIEW_REQUIRED');
const RESERVED_REFERRAL_CASHOUT_STATUSES = [
  CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS,
  CASHOUT_APPROVED_REFERRAL_REWARD_STATUS,
  TAX_REVIEW_REQUIRED_REFERRAL_REWARD_STATUS,
] as const;

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

type ReferralAttributionRecord = Prisma.ReferralAttributionGetPayload<{
  select: typeof referralAttributionSelect;
}>;

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

type CompletedBookingReferralRecord = Prisma.BookingGetPayload<{
  select: typeof completedBookingReferralSelect;
}>;
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
  updatedAt: true,
  walletLedgerReference: true,
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardRecord = Prisma.ReferralRewardGetPayload<{ select: typeof referralRewardSelect }>;

const referralRewardCreditCandidateSelect = {
  availableAt: true,
  id: true,
  amount: true,
  calculationSnapshot: true,
  currency: true,
  qualifyingBookingId: true,
  sourceKey: true,
  status: true,
  updatedAt: true,
  walletLedgerReference: true,
  walletOwnerCustomerProfileId: true,
  walletOwnerProviderProfileId: true,
  metadata: true,
  attribution: {
    select: {
      audience: true,
      fraudReviewStatus: true,
      referrerCustomerProfileId: true,
      referrerProviderProfileId: true,
      status: true,
      metadata: true,
      referralCode: { select: { metadata: true } },
    },
  },
  qualifyingBooking: {
    select: {
      customerProfileId: true,
      earning: { select: { id: true } },
      id: true,
      payment: { select: { method: true, status: true } },
      refunds: { select: { status: true } },
      selectedProviderId: true,
      settlementSnapshot: {
        select: {
          customerProfileId: true,
          providerProfileId: true,
          reversedById: true,
          settlementStatus: true,
        },
      },
      status: true,
    },
  },
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardCreditCandidate = Prisma.ReferralRewardGetPayload<{
  select: typeof referralRewardCreditCandidateSelect;
}>;

type ReferralRewardLedgerCandidate = Pick<
  ReferralRewardCreditCandidate,
  | 'amount'
  | 'availableAt'
  | 'calculationSnapshot'
  | 'currency'
  | 'id'
  | 'qualifyingBookingId'
  | 'sourceKey'
  | 'status'
  | 'walletLedgerReference'
  | 'walletOwnerCustomerProfileId'
  | 'walletOwnerProviderProfileId'
>;

const referralRewardCashoutReservationSelect = {
  amount: true,
  availableAt: true,
  calculationSnapshot: true,
  currency: true,
  id: true,
  qualifyingBookingId: true,
  sourceKey: true,
  status: true,
  walletLedgerReference: true,
  walletOwnerCustomerProfileId: true,
  walletOwnerProviderProfileId: true,
} satisfies Prisma.ReferralRewardSelect;

const referralRewardCandidateStateSelect = {
  amount: true,
  availableAt: true,
  currency: true,
  id: true,
  status: true,
  updatedAt: true,
  walletLedgerReference: true,
  metadata: true,
  attribution: {
    select: {
      metadata: true,
      referralCode: { select: { metadata: true } },
    },
  },
} satisfies Prisma.ReferralRewardSelect;

type ReferralRewardCandidateState = Prisma.ReferralRewardGetPayload<{
  select: typeof referralRewardCandidateStateSelect;
}>;

type ReferralRewardExpectedState = {
  expectedStatus: ReferralRewardStatus;
  expectedUpdatedAt: string;
};

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

type ReferralRewardClient = PrismaService | Prisma.TransactionClient;

type ReferralListInput = {
  cursor?: string;
  limit?: number;
};

@Injectable()
export class ReferralsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifications?: NotificationsService,
  ) {}

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
    const [referralCode, referralCount, validReferralCount, rewardGroups, policy] = await Promise.all([
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
      this.prisma.referralAttribution.count({
        where: {
          audience: ReferralAudience.CUSTOMER,
          referrerCustomerProfileId: profile.id,
          status: {
            in: [
              ReferralAttributionStatus.REGISTERED,
              ReferralAttributionStatus.QUALIFIED,
              ReferralAttributionStatus.REWARDED,
            ],
          },
        },
      }),
      this.prisma.referralReward.groupBy({
        by: ['status', 'currency'],
        where: { walletOwnerCustomerProfileId: profile.id },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.prisma.referralPolicy.findUnique({
        where: { audience: ReferralAudience.CUSTOMER },
        select: referralPolicySelect,
      }),
    ]);

    return {
      policy: referralPolicyView(policy),
      referralCode: referralCode ? referralCodeView(referralCode) : null,
      totals: referralRewardTotals(referralCount, rewardGroups, validReferralCount),
    };
  }

  async listCustomerReferralInvites(userId: string, input: ReferralListInput = {}) {
    const profile = await this.customerProfileForUser(userId);
    const limit = referralListLimit(input.limit);
    const rows = await this.prisma.referralAttribution.findMany({
      where: {
        audience: ReferralAudience.CUSTOMER,
        referrerCustomerProfileId: profile.id,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      select: {
        id: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        referredCustomerProfile: {
          select: {
            user: { select: { fullName: true, phone: true } },
          },
        },
        _count: { select: { rewards: true } },
      },
    });
    const hasMore = rows.length > limit;
    const visibleRows = hasMore ? rows.slice(0, limit) : rows;

    return {
      rows: visibleRows.map((row) => ({
        id: row.id,
        displayName: maskReferralCustomerDisplayName(
          row.referredCustomerProfile?.user.fullName,
          row.referredCustomerProfile?.user.phone,
        ),
        status: row.status,
        attributedAt: row.createdAt,
        updatedAt: row.updatedAt,
        rewardConditionMet:
          row.status === ReferralAttributionStatus.QUALIFIED ||
          row.status === ReferralAttributionStatus.REWARDED ||
          row._count.rewards > 0,
      })),
      pagination: {
        nextCursor: hasMore ? (visibleRows.at(-1)?.id ?? null) : null,
      },
    };
  }

  async listCustomerReferralRewards(userId: string, input: ReferralListInput = {}) {
    const profile = await this.customerProfileForUser(userId);
    const limit = referralListLimit(input.limit);
    const [rows, walletBalance] = await Promise.all([
      this.prisma.referralReward.findMany({
        where: { walletOwnerCustomerProfileId: profile.id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        select: {
          id: true,
          amount: true,
          availableAt: true,
          calculationSnapshot: true,
          createdAt: true,
          currency: true,
          qualifyingBookingId: true,
          sourceKey: true,
          status: true,
          walletLedgerReference: true,
          walletOwnerCustomerProfileId: true,
          walletOwnerProviderProfileId: true,
        },
      }),
      this.prisma.customerWalletLedgerEntry.aggregate({
        where: { customerProfileId: profile.id },
        _sum: { amount: true },
      }),
    ]);
    const hasMore = rows.length > limit;
    const visibleRows = hasMore ? rows.slice(0, limit) : rows;
    const availableBalance = walletBalance._sum.amount ?? 0;

    return {
      rows: visibleRows.map((row) => {
        const cashoutAmount = referralRewardNetWalletAmount(row);
        const canRequestCashout =
          isCreditedReferralRewardStatus(row.status) &&
          Boolean(row.walletLedgerReference) &&
          availableBalance >= cashoutAmount;
        return {
          id: row.id,
          amount: row.amount,
          availableAt: row.availableAt,
          bookingReference: referralBookingReference(row.qualifyingBookingId),
          canRequestCashout,
          cashoutUnavailableReason: canRequestCashout
            ? null
            : referralCashoutUnavailableReason(row, availableBalance, cashoutAmount),
          cashoutAmount,
          createdAt: row.createdAt,
          currency: row.currency,
          status: row.status,
        };
      }),
      pagination: {
        nextCursor: hasMore ? (visibleRows.at(-1)?.id ?? null) : null,
      },
    };
  }

  async issueCustomerReferralCode(userId: string) {
    const existing = await this.getCustomerReferralCode(userId);
    if (existing) {
      return existing;
    }

    await this.assertReferralProgramEnabled(ReferralAudience.CUSTOMER);
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
    const claim = normalizeReferralClaim(input);
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

    await this.assertReferralProgramEnabled(ReferralAudience.CUSTOMER);
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

  async requestCustomerRewardCashout(userId: string, rewardId: string) {
    const profile = await this.customerProfileForUser(userId);
    return this.requestRewardCashout(rewardId, {
      walletOwnerCustomerProfileId: profile.id,
    });
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

  async requestPartnerRewardCashout(userId: string, rewardId: string) {
    const profile = await this.partnerProfileForUser(userId);
    return this.requestRewardCashout(rewardId, {
      walletOwnerProviderProfileId: profile.id,
    });
  }

  async releaseAvailableRewards(referenceDate = new Date()) {
    const result = await this.prisma.referralReward.updateMany({
      data: { status: ReferralRewardStatus.AVAILABLE },
      where: {
        availableAt: { lte: referenceDate },
        status: ReferralRewardStatus.PENDING,
        NOT: referralAdminFixtureRewardWhere,
      },
    });

    return { releasedCount: result.count };
  }

  async holdRewardCandidate(rewardId: string, expected: ReferralRewardExpectedState) {
    return this.updateRewardCandidateStatus(rewardId, ReferralRewardStatus.HELD, expected);
  }

  async releaseHeldRewardCandidate(rewardId: string, expected: ReferralRewardExpectedState) {
    return this.runSerializableTransaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: rewardId },
        select: referralRewardCreditCandidateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertExpectedRewardState(reward, expected);
      this.assertRewardIsNotFixture(reward);
      this.assertRewardEvidence(reward);
      this.assertRewardCandidateCanChangeStatus(reward, ReferralRewardStatus.AVAILABLE);
      const transition = await tx.referralReward.updateMany({
        data: { status: ReferralRewardStatus.AVAILABLE },
        where: {
          id: rewardId,
          status: expected.expectedStatus,
          updatedAt: new Date(expected.expectedUpdatedAt),
        },
      });
      if (transition.count !== 1) {
        throw this.rewardStateChangedError();
      }
      return tx.referralReward.findUniqueOrThrow({
        where: { id: rewardId },
        select: referralRewardSelect,
      });
    });
  }

  async reverseRewardCandidate(rewardId: string, expected: ReferralRewardExpectedState) {
    const reward = await this.prisma.referralReward.findUnique({
      where: { id: rewardId },
      select: referralRewardCreditCandidateSelect,
    });
    if (!reward) {
      throw new NotFoundException('Referral reward was not found');
    }
    this.assertExpectedRewardState(reward, expected);
    this.assertRewardIsNotFixture(reward);
    if (isCreditedReferralRewardStatus(reward.status)) {
      return this.reverseCreditedRewardCandidate(reward, expected);
    }
    return this.updateRewardCandidateStatus(rewardId, ReferralRewardStatus.REVERSED, expected);
  }

  async approveRewardCashoutRequest(rewardId: string, expected: ReferralRewardExpectedState) {
    return this.updateRewardLifecycleStatus(rewardId, CASHOUT_APPROVED_REFERRAL_REWARD_STATUS, {
      allowedStatuses: [CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS],
    }, expected);
  }

  async requireRewardTaxReview(rewardId: string, expected: ReferralRewardExpectedState) {
    return this.updateRewardLifecycleStatus(rewardId, TAX_REVIEW_REQUIRED_REFERRAL_REWARD_STATUS, {
      blockedStatuses: [ReferralRewardStatus.CANCELLED, ReferralRewardStatus.REVERSED],
    }, expected);
  }

  async creditRewardCandidate(rewardId: string, expected: ReferralRewardExpectedState) {
    const outcome = await this.runSerializableTransaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: rewardId },
        select: referralRewardCreditCandidateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertExpectedRewardState(reward, expected);
      this.assertRewardIsNotFixture(reward);
      await this.assertRewardCandidateCanBeCredited(tx, reward);
      await this.claimRewardForWalletMutation(tx, reward, expected);

      const ledgerSourceKey = referralWalletCreditSourceKey(reward.id);
      const walletCreditAmount = referralRewardNetWalletAmount(reward);
      const ledger = reward.walletOwnerCustomerProfileId
        ? await tx.customerWalletLedgerEntry.upsert({
            where: { sourceKey: ledgerSourceKey },
            update: {},
            create: {
              amount: walletCreditAmount,
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
              amount: walletCreditAmount,
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

      await upsertReferralRewardJournal(tx, reward, ledger.id, 'wallet-credit');

      const creditedReward = await tx.referralReward.update({
        data: {
          status: CREDITED_REFERRAL_REWARD_STATUS,
          walletLedgerReference: ledger.id,
        },
        where: { id: reward.id, status: ReferralRewardStatus.LOCKED },
        select: referralRewardSelect,
      });

      if (!reward.walletOwnerCustomerProfileId) {
        return { notificationId: null, reward: creditedReward };
      }

      const walletOwner = await tx.customerProfile.findUniqueOrThrow({
        where: { id: reward.walletOwnerCustomerProfileId },
        select: { userId: true },
      });
      const copy = customerReferralRewardNotification({
        amount: walletCreditAmount,
        bookingId: reward.qualifyingBookingId,
        currency: reward.currency,
        ledgerId: ledger.id,
        rewardId: reward.id,
      });
      const notification = await tx.notification.create({
        data: {
          userId: walletOwner.userId,
          type: copy.type,
          title: copy.title,
          body: copy.body,
          data: toJson(notificationDataWithDeliveryContract(
            notificationDataWithTargetRole(copy.data, Role.CUSTOMER),
            'PUSH_AND_IN_APP',
          )),
        },
        select: { id: true },
      });

      return { notificationId: notification.id, reward: creditedReward };
    });

    if (outcome.notificationId) {
      await this.notifications?.enqueuePersistedNotification(outcome.notificationId);
    }

    return outcome.reward;
  }

  async payRewardCashout(
    rewardId: string,
    input: { expectedStatus: ReferralRewardStatus; expectedUpdatedAt: string; notes?: string | null; reference?: string | null },
  ) {
    return this.runSerializableTransaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: rewardId },
        select: referralRewardCreditCandidateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertExpectedRewardState(reward, input);
      this.assertRewardIsNotFixture(reward);
      this.assertRewardCashoutCanBePaid(reward);
      await this.lockRewardWallet(tx, reward);
      await this.assertRewardCashoutWalletBalance(tx, reward);
      await this.claimRewardForWalletMutation(tx, reward, input);

      const ledgerSourceKey = referralWalletCashoutSourceKey(reward.id);
      const reference = normalizeOptionalText(input.reference ?? undefined);
      const notes = normalizeOptionalText(input.notes ?? undefined);
      const walletCashoutAmount = referralRewardNetWalletAmount(reward);
      const ledger = reward.walletOwnerCustomerProfileId
        ? await upsertImmutableCustomerWalletLedger(tx, {
            amount: -walletCashoutAmount,
            bookingId: reward.qualifyingBookingId,
            currency: reward.currency,
            customerProfileId: reward.walletOwnerCustomerProfileId,
            metadata: referralWalletCashoutMetadata(reward, 'CUSTOMER'),
            notes,
            referralRewardId: reward.id,
            reference,
            sourceKey: ledgerSourceKey,
            type: customerWalletLedgerType('CUSTOMER_REFERRAL_CASHOUT'),
          })
        : await upsertImmutableProviderWalletLedger(tx, {
            amount: -walletCashoutAmount,
            bookingId: reward.qualifyingBookingId,
            currency: reward.currency,
            metadata: referralWalletCashoutMetadata(reward, 'PARTNER'),
            notes,
            providerProfileId: reward.walletOwnerProviderProfileId as string,
            reference,
            sourceKey: ledgerSourceKey,
            type: providerWalletLedgerType('PARTNER_REFERRAL_CASHOUT'),
          });

      await upsertReferralRewardJournal(tx, reward, ledger.id, 'wallet-cashout');

      return tx.referralReward.update({
        data: {
          status: PAID_REFERRAL_REWARD_STATUS,
          walletLedgerReference: ledger.id,
        },
        where: { id: reward.id, status: ReferralRewardStatus.LOCKED },
        select: referralRewardSelect,
      });
    });
  }

  private async reverseCreditedRewardCandidate(
    reward: ReferralRewardCreditCandidate,
    expected: ReferralRewardExpectedState,
  ) {
    if (!reward.walletLedgerReference) {
      throw new BadRequestException(
        'Credited referral reward reversal requires an existing wallet ledger reference',
      );
    }
    if (!reward.walletOwnerCustomerProfileId && !reward.walletOwnerProviderProfileId) {
      throw new BadRequestException('Referral reward does not have a wallet owner');
    }

    return this.runSerializableTransaction(async (tx) => {
      await this.claimRewardForWalletMutation(tx, reward, expected);
      const ledgerSourceKey = referralWalletReversalSourceKey(reward.id);
      const walletReversalAmount = referralRewardNetWalletAmount(reward);
      const ledger = reward.walletOwnerCustomerProfileId
        ? await upsertImmutableCustomerWalletLedger(tx, {
            amount: -walletReversalAmount,
            bookingId: reward.qualifyingBookingId,
            currency: reward.currency,
            customerProfileId: reward.walletOwnerCustomerProfileId,
            metadata: referralWalletReversalMetadata(reward, 'CUSTOMER'),
            referralRewardId: reward.id,
            reference: reward.sourceKey,
            sourceKey: ledgerSourceKey,
            type: customerWalletLedgerType('CUSTOMER_REFERRAL_REVERSED'),
          })
        : await upsertImmutableProviderWalletLedger(tx, {
            amount: -walletReversalAmount,
            bookingId: reward.qualifyingBookingId,
            currency: reward.currency,
            metadata: referralWalletReversalMetadata(reward, 'PARTNER'),
            providerProfileId: reward.walletOwnerProviderProfileId as string,
            reference: reward.sourceKey,
            sourceKey: ledgerSourceKey,
            type: providerWalletLedgerType('PARTNER_REFERRAL_REVERSED'),
          });

      await upsertReferralRewardJournal(tx, reward, ledger.id, 'wallet-reversal');

      return tx.referralReward.update({
        data: {
          status: ReferralRewardStatus.REVERSED,
          walletLedgerReference: ledger.id,
        },
        where: { id: reward.id, status: ReferralRewardStatus.LOCKED },
        select: referralRewardSelect,
      });
    });
  }

  async createRewardsForCompletedBooking(bookingId: string) {
    return this.runSerializableTransaction(async (tx) => {
      const booking = await tx.booking.findUnique({
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
      const customerReward = await this.createCustomerRewardForCompletedBooking(tx, completedBooking);
      const partnerReward = await this.createPartnerRewardForCompletedBooking(tx, completedBooking);
      return { customerReward, partnerReward };
    });
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

  private async requestRewardCashout(
    rewardId: string,
    ownerWhere: Partial<
      Pick<Prisma.ReferralRewardWhereInput, 'walletOwnerCustomerProfileId' | 'walletOwnerProviderProfileId'>
    >,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const reward = await tx.referralReward.findFirst({
        where: { id: rewardId, ...ownerWhere },
        select: referralRewardCreditCandidateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertRewardIsNotFixture(reward);
      if (reward.status === CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS) {
        return tx.referralReward.findUniqueOrThrow({
          where: { id: reward.id },
          select: referralRewardSelect,
        });
      }
      if (!isCreditedReferralRewardStatus(reward.status)) {
        throw new BadRequestException('Only credited referral rewards can request cashout');
      }
      if (!reward.walletLedgerReference) {
        throw new BadRequestException('Referral cashout requires an existing wallet ledger reference');
      }
      await this.lockRewardWallet(tx, reward);
      await this.assertRewardCashoutWalletBalance(tx, reward);

      const transition = await tx.referralReward.updateMany({
        data: { status: CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS },
        where: {
          id: reward.id,
          ...ownerWhere,
          status: reward.status,
          walletLedgerReference: reward.walletLedgerReference,
        },
      });
      if (transition.count !== 1) {
        const latest = await tx.referralReward.findUnique({
          where: { id: reward.id },
          select: referralRewardSelect,
        });
        if (latest?.status === CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS) {
          return latest;
        }
        throw new BadRequestException('Referral reward cashout state changed; refresh and try again');
      }

      return tx.referralReward.findUniqueOrThrow({
        where: { id: reward.id },
        select: referralRewardSelect,
      });
    });
  }

  private async assertRewardCashoutWalletBalance(
    tx: Prisma.TransactionClient,
    reward: ReferralRewardLedgerCandidate,
  ) {
    const balance = reward.walletOwnerCustomerProfileId
      ? await tx.customerWalletLedgerEntry.aggregate({
          where: {
            customerProfileId: reward.walletOwnerCustomerProfileId,
            currency: reward.currency,
          },
          _sum: { amount: true },
        })
      : await tx.providerWalletLedgerEntry.aggregate({
          where: {
            providerProfileId: reward.walletOwnerProviderProfileId as string,
            currency: reward.currency,
          },
          _sum: { amount: true },
        });
    const availableBalance = balance._sum.amount ?? 0;
    const reservedCashouts = await tx.referralReward.findMany({
      where: {
        id: { not: reward.id },
        currency: reward.currency,
        status: { in: [...RESERVED_REFERRAL_CASHOUT_STATUSES] },
        ...(reward.walletOwnerCustomerProfileId
          ? { walletOwnerCustomerProfileId: reward.walletOwnerCustomerProfileId }
          : { walletOwnerProviderProfileId: reward.walletOwnerProviderProfileId as string }),
      },
      select: referralRewardCashoutReservationSelect,
    });
    const reservedCashoutAmount = reservedCashouts.reduce(
      (total, reservedReward) => total + referralRewardNetWalletAmount(reservedReward),
      0,
    );
    const cashoutAmount = referralRewardNetWalletAmount(reward);
    if (availableBalance - reservedCashoutAmount < cashoutAmount) {
      throw new BadRequestException('Wallet balance cannot cover referral cashout');
    }
  }

  private async lockRewardWallet(
    tx: Prisma.TransactionClient,
    reward: ReferralRewardLedgerCandidate,
  ) {
    const lockKey = reward.walletOwnerCustomerProfileId
      ? customerWalletBookingLockKey(reward.walletOwnerCustomerProfileId)
      : `${reward.walletOwnerProviderProfileId as string}:${reward.currency}`;
    await tx.$queryRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "lockResult"`,
    );
  }

  private async createCustomerRewardForCompletedBooking(
    tx: Prisma.TransactionClient,
    booking: CompletedBookingReferralWithEarning,
  ) {
    const [policy, attribution] = await Promise.all([
      this.referralPolicyFor(ReferralAudience.CUSTOMER, tx),
      tx.referralAttribution.findFirst({
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
    const baseRewardAmount =
      policy.rewardMode === ReferralRewardMode.COMMISSION_PERCENT && policy.commissionPercentBps
        ? calculateCustomerReferralReward({
            platformFeeGross: booking.earning.platformFee,
            platformFeeVatRateBps: referralPlatformFeeVatRateBps(policy),
            referralRateBps: policy.commissionPercentBps,
          }).rewardGross
        : policy.rewardMode === ReferralRewardMode.FIXED_AMOUNT && policy.fixedRewardAmount
          ? policy.fixedRewardAmount
          : null;
    if (!baseRewardAmount) {
      return null;
    }
    const referrerCustomerProfileId = attribution.referrerCustomerProfileId;
    await this.lockReferralRewardScope(
      tx,
      ReferralAudience.CUSTOMER,
      referrerCustomerProfileId,
      attribution.id,
    );
    const sourceKey = referralRewardSourceKey(ReferralAudience.CUSTOMER, attribution.id, booking.id);
    const existing = await tx.referralReward.findUnique({
      where: { sourceKey },
      select: referralRewardSelect,
    });
    if (existing) {
      return existing;
    }
    const [referrerSlotsAvailable, referredSlotsAvailable] = await Promise.all([
      this.referrerRewardSlotsAvailable(
        {
          audience: ReferralAudience.CUSTOMER,
          maxRewardedReferrals: policy.maxRewardedReferrals,
          walletOwnerCustomerProfileId: referrerCustomerProfileId,
        },
        tx,
      ),
      this.referredRewardSlotsAvailable(
        {
          attributionId: attribution.id,
          maxRewardsPerReferred: policy.maxRewardsPerReferred,
        },
        tx,
      ),
    ]);
    if (!referrerSlotsAvailable || !referredSlotsAvailable) {
      return null;
    }
    const amount = await this.rewardAmountAfterLifetimeCap(
      cappedRewardAmount(baseRewardAmount, policy.perRewardCapAmount),
      {
        audience: ReferralAudience.CUSTOMER,
        totalRewardCapAmount: policy.totalRewardCapAmount,
        walletOwnerCustomerProfileId: referrerCustomerProfileId,
      },
      tx,
    );
    if (amount <= 0) {
      return null;
    }
    return this.createReferralReward(
      {
        amount,
        attribution,
        booking,
        policy,
        sourceKey,
        walletOwnerCustomerProfileId: referrerCustomerProfileId,
      },
      tx,
    );
  }

  private async createPartnerRewardForCompletedBooking(
    tx: Prisma.TransactionClient,
    booking: CompletedBookingReferralWithEarning,
  ) {
    const [policy, attribution] = await Promise.all([
      this.referralPolicyFor(ReferralAudience.PARTNER, tx),
      tx.referralAttribution.findFirst({
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
    const fixedRewardAmount = policy.fixedRewardAmount;
    const referredProviderProfileId = attribution.referredProviderProfileId;
    const referrerProviderProfileId = attribution.referrerProviderProfileId;

    await this.lockReferralRewardScope(
      tx,
      ReferralAudience.PARTNER,
      referrerProviderProfileId,
      attribution.id,
    );
    const sourceKey = referralRewardSourceKey(ReferralAudience.PARTNER, attribution.id, booking.id);
    const existing = await tx.referralReward.findUnique({
      where: { sourceKey },
      select: referralRewardSelect,
    });
    if (existing) {
      return existing;
    }
    const [alreadyCompletedBookings, referrerSlotsAvailable, referredSlotsAvailable] = await Promise.all([
      tx.providerEarning.count({
        where: {
          providerProfileId: referredProviderProfileId,
          bookingId: { not: booking.id },
          booking: { status: BookingStatus.COMPLETED },
        },
      }),
      this.referrerRewardSlotsAvailable(
        {
          audience: ReferralAudience.PARTNER,
          maxRewardedReferrals: policy.maxRewardedReferrals,
          walletOwnerProviderProfileId: referrerProviderProfileId,
        },
        tx,
      ),
      this.referredRewardSlotsAvailable(
        {
          attributionId: attribution.id,
          maxRewardsPerReferred: policy.maxRewardsPerReferred,
        },
        tx,
      ),
    ]);
    if (alreadyCompletedBookings > 0 || !referrerSlotsAvailable || !referredSlotsAvailable) {
      return null;
    }
    const amount = await this.rewardAmountAfterLifetimeCap(
      cappedRewardAmount(fixedRewardAmount, policy.perRewardCapAmount),
      {
        audience: ReferralAudience.PARTNER,
        totalRewardCapAmount: policy.totalRewardCapAmount,
        walletOwnerProviderProfileId: referrerProviderProfileId,
      },
      tx,
    );
    if (amount <= 0) {
      return null;
    }
    return this.createReferralReward(
      {
        amount,
        attribution,
        booking,
        policy,
        sourceKey,
        walletOwnerProviderProfileId: referrerProviderProfileId,
      },
      tx,
    );
  }

  private async referralPolicyFor(audience: ReferralAudience, client: ReferralRewardClient = this.prisma) {
    const policy = await client.referralPolicy.findUnique({
      where: { audience },
      select: referralPolicySelect,
    });

    return policy?.enabled ? policy : null;
  }

  private async assertReferralProgramEnabled(audience: ReferralAudience) {
    const policy = await this.referralPolicyFor(audience);
    if (!policy) {
      throw new BadRequestException('Referral program is not active');
    }
    return policy;
  }

  private async referrerRewardSlotsAvailable(input: {
    audience: ReferralAudience;
    maxRewardedReferrals: number | null;
    walletOwnerCustomerProfileId?: string;
    walletOwnerProviderProfileId?: string;
  }, client: ReferralRewardClient = this.prisma) {
    if (!input.maxRewardedReferrals) {
      return true;
    }

    const rewardCount = await client.referralReward.count({
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
  }, client: ReferralRewardClient = this.prisma) {
    if (!input.maxRewardsPerReferred) {
      return true;
    }

    const rewardCount = await client.referralReward.count({
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
    client: ReferralRewardClient = this.prisma,
  ) {
    if (!input.totalRewardCapAmount) {
      return amount;
    }

    const existingRewards = await client.referralReward.aggregate({
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
  }, client: ReferralRewardClient): Promise<ReferralRewardRecord> {
    const existing = await client.referralReward.findUnique({
      where: { sourceKey: input.sourceKey },
      select: referralRewardSelect,
    });
    if (existing) {
      return existing;
    }

    const platformFeeBreakdown = referralPlatformFeeBreakdown(
      input.booking.earning.platformFee,
      input.policy,
    );

    return client.referralReward.create({
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

  private async lockReferralRewardScope(
    tx: Prisma.TransactionClient,
    audience: ReferralAudience,
    walletOwnerId: string,
    attributionId: string,
  ) {
    const lockKeys = [
      `referral-reward:${audience}:owner:${walletOwnerId}`,
      `referral-reward:${audience}:attribution:${attributionId}`,
    ].sort();
    for (const lockKey of lockKeys) {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))::text AS "lockResult"`,
      );
    }
  }

  private async runSerializableTransaction<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (error) {
        const canRetry =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!canRetry) {
          throw error;
        }
        if (attempt === 2) {
          throw new ConflictException('Referral reward changed concurrently; reload and try again');
        }
      }
    }

    throw new ConflictException('Referral reward changed concurrently; reload and try again');
  }

  private async updateRewardCandidateStatus(
    rewardId: string,
    status: ReferralRewardStatus,
    expected: ReferralRewardExpectedState,
  ) {
    return this.runSerializableTransaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: rewardId },
        select: referralRewardCandidateStateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertExpectedRewardState(reward, expected);
      this.assertRewardIsNotFixture(reward);
      this.assertRewardCandidateCanChangeStatus(reward, status);
      const transition = await tx.referralReward.updateMany({
        data: { status },
        where: {
          id: rewardId,
          status: expected.expectedStatus,
          updatedAt: new Date(expected.expectedUpdatedAt),
        },
      });
      if (transition.count !== 1) {
        throw this.rewardStateChangedError();
      }
      return tx.referralReward.findUniqueOrThrow({
        where: { id: rewardId },
        select: referralRewardSelect,
      });
    });
  }

  private async updateRewardLifecycleStatus(
    rewardId: string,
    status: ReferralRewardStatus,
    options: {
      allowedStatuses?: readonly ReferralRewardStatus[];
      blockedStatuses?: readonly ReferralRewardStatus[];
    },
    expected: ReferralRewardExpectedState,
  ) {
    return this.runSerializableTransaction(async (tx) => {
      const reward = await tx.referralReward.findUnique({
        where: { id: rewardId },
        select: referralRewardCandidateStateSelect,
      });
      if (!reward) {
        throw new NotFoundException('Referral reward was not found');
      }
      this.assertExpectedRewardState(reward, expected);
      this.assertRewardIsNotFixture(reward);
      const allowedStatuses = options.allowedStatuses ? new Set(options.allowedStatuses) : null;
      const blockedStatuses = options.blockedStatuses ? new Set(options.blockedStatuses) : null;

      if (allowedStatuses && !allowedStatuses.has(reward.status)) {
        throw new BadRequestException('Referral reward is not in the required lifecycle state');
      }
      if (blockedStatuses?.has(reward.status)) {
        throw new BadRequestException('Closed referral rewards cannot move back into review');
      }
      const transition = await tx.referralReward.updateMany({
        data: { status },
        where: {
          id: rewardId,
          status: expected.expectedStatus,
          updatedAt: new Date(expected.expectedUpdatedAt),
        },
      });
      if (transition.count !== 1) {
        throw this.rewardStateChangedError();
      }
      return tx.referralReward.findUniqueOrThrow({
        where: { id: rewardId },
        select: referralRewardSelect,
      });
    });
  }

  private assertRewardCandidateCanChangeStatus(
    reward: ReferralRewardCandidateState,
    nextStatus: ReferralRewardStatus,
  ) {
    if (reward.walletLedgerReference) {
      throw new BadRequestException('Credited referral rewards require a wallet reversal flow');
    }

    if (nextStatus === ReferralRewardStatus.HELD) {
      if (!HOLDABLE_REWARD_CANDIDATE_STATUSES.has(reward.status)) {
        throw new BadRequestException('Only pending or available referral reward candidates can be held');
      }
      return;
    }

    if (nextStatus === ReferralRewardStatus.AVAILABLE) {
      if (reward.status !== ReferralRewardStatus.HELD) {
        throw new BadRequestException('Only held referral rewards can be released for wallet review');
      }
      return;
    }

    if (nextStatus === ReferralRewardStatus.REVERSED) {
      if (!REVERSIBLE_REWARD_CANDIDATE_STATUSES.has(reward.status)) {
        throw new BadRequestException('Only uncredited referral reward candidates can be reversed');
      }
    }
  }

  private async assertRewardCandidateCanBeCredited(
    tx: Prisma.TransactionClient,
    reward: ReferralRewardCreditCandidate,
  ) {
    if (reward.status !== ReferralRewardStatus.AVAILABLE) {
      throw new BadRequestException('Only available referral rewards can be credited to wallets');
    }
    this.assertRewardIsNotFixture(reward);
    this.assertRewardEvidence(reward);
    const ledgerSourceKey = referralWalletCreditSourceKey(reward.id);
    const existingLedger = reward.walletOwnerCustomerProfileId
      ? await tx.customerWalletLedgerEntry.findUnique({ where: { sourceKey: ledgerSourceKey }, select: { id: true } })
      : await tx.providerWalletLedgerEntry.findUnique({ where: { sourceKey: ledgerSourceKey }, select: { id: true } });
    if (existingLedger) {
      throw new ConflictException('Referral reward already has a wallet credit ledger entry');
    }
  }

  private assertExpectedRewardState(
    reward: Pick<ReferralRewardCandidateState, 'status' | 'updatedAt'>,
    expected: ReferralRewardExpectedState,
  ) {
    if (
      reward.status !== expected.expectedStatus ||
      reward.updatedAt.toISOString() !== new Date(expected.expectedUpdatedAt).toISOString()
    ) {
      throw this.rewardStateChangedError();
    }
  }

  private assertRewardEvidence(reward: ReferralRewardCreditCandidate) {
    const evidenceBlocker = referralRewardEvidenceBlocker(reward);
    if (evidenceBlocker) {
      throw new ConflictException(evidenceBlocker);
    }
  }

  private assertRewardIsNotFixture(
    reward: Pick<ReferralRewardCreditCandidate, 'metadata' | 'attribution'> | ReferralRewardCandidateState,
  ) {
    if (isReferralRewardFixture(reward)) {
      throw new ConflictException({
        code: 'REFERRAL_FIXTURE_MUTATION_BLOCKED',
        message: 'Test fixture rewards cannot change wallet or reward state.',
      });
    }
  }

  private rewardStateChangedError() {
    return new ConflictException({
      code: 'REWARD_STATE_CHANGED',
      message: 'Referral reward changed after this decision was loaded.',
    });
  }

  private async claimRewardForWalletMutation(
    tx: Prisma.TransactionClient,
    reward: Pick<ReferralRewardCreditCandidate, 'id'>,
    expected: ReferralRewardExpectedState,
  ) {
    const transition = await tx.referralReward.updateMany({
      data: { status: ReferralRewardStatus.LOCKED },
      where: {
        id: reward.id,
        status: expected.expectedStatus,
        updatedAt: new Date(expected.expectedUpdatedAt),
      },
    });
    if (transition.count !== 1) {
      throw new ConflictException('Referral reward changed after this decision was loaded');
    }
  }

  private assertRewardCashoutCanBePaid(reward: ReferralRewardLedgerCandidate) {
    if (reward.status !== CASHOUT_APPROVED_REFERRAL_REWARD_STATUS) {
      throw new BadRequestException('Only approved referral cashouts can be marked paid');
    }
    if (!reward.walletLedgerReference) {
      throw new BadRequestException('Referral cashout requires an existing wallet ledger reference');
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

function referralRewardTotals(
  referralCount: number,
  groups: ReferralRewardSummaryGroup[],
  validReferralCount?: number,
) {
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
  let paidOutAmount = 0;
  let processingAmount = 0;
  let totalRewardAmount = 0;

  for (const group of groups) {
    const amount = group._sum.amount ?? 0;
    totals.currency = group.currency || totals.currency;
    totals.rewardCount += group._count._all;
    if (group.status !== ReferralRewardStatus.CANCELLED && group.status !== ReferralRewardStatus.REVERSED) {
      totalRewardAmount += amount;
    }
    if (group.status === PAID_REFERRAL_REWARD_STATUS) {
      paidOutAmount += amount;
    } else if (
      group.status !== ReferralRewardStatus.CANCELLED &&
      group.status !== ReferralRewardStatus.REVERSED &&
      group.status !== referralRewardStatus('USED_FOR_SERVICE') &&
      group.status !== referralRewardStatus('OFFSET')
    ) {
      processingAmount += amount;
    }
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

  return validReferralCount === undefined
    ? totals
    : {
        ...totals,
        invitedFriendCount: validReferralCount,
        paidOutAmount,
        processingAmount,
        totalRewardAmount,
      };
}

function referralPolicyView(policy: ReferralPolicyRecord | null) {
  if (!policy) return null;

  return {
    commissionPercentBps: policy.commissionPercentBps,
    currency: policy.currency,
    enabled: policy.enabled,
    fixedRewardAmount: policy.fixedRewardAmount,
    holdPeriodDays: policy.holdPeriodDays,
    maxRewardedReferrals: policy.maxRewardedReferrals,
    maxRewardsPerReferred: policy.maxRewardsPerReferred,
    perRewardCapAmount: policy.perRewardCapAmount,
    rewardMode: policy.rewardMode,
    totalRewardCapAmount: policy.totalRewardCapAmount,
  };
}

function referralListLimit(value: number | undefined) {
  return Math.min(Math.max(value ?? 20, 1), 50);
}

function maskReferralCustomerDisplayName(
  fullName: string | null | undefined,
  phone: string | null | undefined,
) {
  const name = fullName?.trim();
  if (name) {
    const parts = name.split(/\s+/u);
    return parts
      .map((part) =>
        part.length <= 1 ? `${part}*` : `${part.slice(0, 1)}${'*'.repeat(Math.min(part.length - 1, 3))}`,
      )
      .join(' ');
  }
  const digits = phone?.replace(/\D/gu, '') ?? '';
  return digits.length >= 4 ? `HANDS customer · ${digits.slice(-4)}` : 'HANDS customer';
}

function referralBookingReference(bookingId: string | null) {
  if (!bookingId) return null;
  return `HANDS-${bookingId.slice(-8).toUpperCase()}`;
}

function referralCashoutUnavailableReason(
  reward: ReferralRewardLedgerCandidate,
  availableBalance: number,
  cashoutAmount: number,
) {
  if (
    reward.status === CASHOUT_REQUESTED_REFERRAL_REWARD_STATUS ||
    reward.status === CASHOUT_APPROVED_REFERRAL_REWARD_STATUS ||
    reward.status === TAX_REVIEW_REQUIRED_REFERRAL_REWARD_STATUS
  ) {
    return 'PROCESSING';
  }
  if (
    reward.status === PAID_REFERRAL_REWARD_STATUS ||
    reward.status === referralRewardStatus('USED_FOR_SERVICE') ||
    reward.status === referralRewardStatus('OFFSET') ||
    reward.status === ReferralRewardStatus.CANCELLED ||
    reward.status === ReferralRewardStatus.REVERSED
  ) {
    return 'COMPLETED';
  }
  if (!isCreditedReferralRewardStatus(reward.status) || !reward.walletLedgerReference) {
    return 'NOT_CREDITED';
  }
  return availableBalance < cashoutAmount ? 'WALLET_BALANCE' : 'NOT_AVAILABLE';
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

function referralWalletCashoutSourceKey(rewardId: string) {
  return `referral:wallet-cashout:${rewardId}`;
}

function referralWalletReversalSourceKey(rewardId: string) {
  return `referral:wallet-reversal:${rewardId}`;
}

function referralWalletCreditMetadata(
  reward: ReferralRewardLedgerCandidate,
  walletOwner: 'CUSTOMER' | 'PARTNER',
) {
  const withholding = referralRewardWithholding(reward);
  return {
    bookingId: reward.qualifyingBookingId,
    grossRewardAmount: withholding.grossRewardAmount,
    netWalletAmount: withholding.netWalletAmount,
    pitWithheldAmount: withholding.pitWithheldAmount,
    referralRewardId: reward.id,
    rewardSourceKey: reward.sourceKey,
    taxPolicySnapshot: withholding.taxPolicySnapshot,
    totalWithheldAmount: withholding.totalWithheldAmount,
    vatWithheldAmount: withholding.vatWithheldAmount,
    walletOwner,
  };
}

function referralWalletCashoutMetadata(
  reward: ReferralRewardLedgerCandidate,
  walletOwner: 'CUSTOMER' | 'PARTNER',
) {
  const withholding = referralRewardWithholding(reward);
  return {
    bookingId: reward.qualifyingBookingId,
    grossRewardAmount: withholding.grossRewardAmount,
    netCashoutAmount: withholding.netWalletAmount,
    pitWithheldAmount: withholding.pitWithheldAmount,
    referralRewardId: reward.id,
    rewardSourceKey: reward.sourceKey,
    taxPolicySnapshot: withholding.taxPolicySnapshot,
    totalWithheldAmount: withholding.totalWithheldAmount,
    vatWithheldAmount: withholding.vatWithheldAmount,
    walletCreditLedgerReference: reward.walletLedgerReference,
    walletOwner,
  };
}

function referralWalletReversalMetadata(
  reward: ReferralRewardLedgerCandidate,
  walletOwner: 'CUSTOMER' | 'PARTNER',
) {
  const withholding = referralRewardWithholding(reward);
  return {
    bookingId: reward.qualifyingBookingId,
    grossRewardAmount: withholding.grossRewardAmount,
    netReversalAmount: withholding.netWalletAmount,
    pitWithheldAmount: withholding.pitWithheldAmount,
    referralRewardId: reward.id,
    rewardSourceKey: reward.sourceKey,
    reversedWalletCreditLedgerReference: reward.walletLedgerReference,
    taxPolicySnapshot: withholding.taxPolicySnapshot,
    totalWithheldAmount: withholding.totalWithheldAmount,
    vatWithheldAmount: withholding.vatWithheldAmount,
    walletOwner,
  };
}

function referralRewardWithholding(reward: ReferralRewardLedgerCandidate) {
  return calculateReferralTaxWithholding({
    grossRewardAmount: reward.amount,
    taxPolicy: referralRewardTaxPolicySnapshot(reward),
  });
}

function referralRewardNetWalletAmount(reward: ReferralRewardLedgerCandidate) {
  return referralRewardWithholding(reward).netWalletAmount;
}

async function upsertImmutableCustomerWalletLedger(
  tx: Prisma.TransactionClient,
  data: Prisma.CustomerWalletLedgerEntryUncheckedCreateInput,
) {
  const ledger = await tx.customerWalletLedgerEntry.upsert({
    where: { sourceKey: data.sourceKey },
    update: {},
    create: data,
  });
  if (!immutableFinancialReplayMatches(ledger, data, CUSTOMER_WALLET_LEDGER_REPLAY_FIELDS)) {
    throw new ConflictException(
      'A customer wallet entry already exists with different financial evidence.',
    );
  }
  return ledger;
}

async function upsertImmutableProviderWalletLedger(
  tx: Prisma.TransactionClient,
  data: Prisma.ProviderWalletLedgerEntryUncheckedCreateInput,
) {
  const ledger = await tx.providerWalletLedgerEntry.upsert({
    where: { sourceKey: data.sourceKey },
    update: {},
    create: data,
  });
  if (!immutableFinancialReplayMatches(ledger, data, PROVIDER_WALLET_LEDGER_REPLAY_FIELDS)) {
    throw new ConflictException(
      'A Partner wallet entry already exists with different financial evidence.',
    );
  }
  return ledger;
}

async function upsertReferralRewardJournal(
  tx: Prisma.TransactionClient,
  reward: ReferralRewardLedgerCandidate,
  ledgerId: string,
  action: 'wallet-credit' | 'wallet-cashout' | 'wallet-reversal',
) {
  const owner = referralRewardWalletOwner(reward);
  const withholding = referralRewardWithholding(reward);
  const sourceKey = `accounting-journal:referral-${action}:${reward.id}`;
  const sourceType = 'REFERRAL_REWARD' as const;
  const metadata = {
    action,
    bookingId: reward.qualifyingBookingId,
    ledgerId,
    manualReviewRequired: withholding.manualReviewRequired,
    referralRewardId: reward.id,
    rewardSourceKey: reward.sourceKey,
    taxPolicySnapshot: withholding.taxPolicySnapshot,
    totalWithheldAmount: withholding.totalWithheldAmount,
    vatWithheldAmount: withholding.vatWithheldAmount,
    pitWithheldAmount: withholding.pitWithheldAmount,
    walletOwner: owner.type,
  } satisfies Prisma.InputJsonObject;
  const entries = (() => {
    if (action === 'wallet-credit') {
      return [
        referralJournalEntry({
          account: `${owner.type}_REFERRAL_REWARD_EXPENSE`,
          amount: reward.amount,
          currency: reward.currency,
          memo: `Referral reward ${reward.id} credited to ${owner.type.toLowerCase()} wallet.`,
          metadata,
          side: 'DEBIT',
          sourceId: reward.id,
          sourceType,
        }),
        ...positiveReferralJournalEntries([
          {
            account: `${owner.type}_WALLET_LIABILITY`,
            amount: withholding.netWalletAmount,
            currency: reward.currency,
            memo: `Referral reward ${reward.id} increases ${owner.type.toLowerCase()} wallet liability.`,
            metadata,
            side: 'CREDIT',
            sourceId: reward.id,
            sourceType,
          },
          ...referralWithholdingPayableEntries({
            currency: reward.currency,
            metadata,
            rewardId: reward.id,
            side: 'CREDIT',
            sourceType,
            withholding,
          }),
        ]),
      ];
    }
    if (action === 'wallet-cashout') {
      return positiveReferralJournalEntries([
        {
          account: `${owner.type}_WALLET_LIABILITY`,
          amount: withholding.netWalletAmount,
          currency: reward.currency,
          memo: `Referral cashout ${reward.id} decreases ${owner.type.toLowerCase()} wallet liability.`,
          metadata,
          side: 'DEBIT',
          sourceId: reward.id,
          sourceType,
        },
        {
          account: 'REFERRAL_CASHOUT_BANK_CLEARING',
          amount: withholding.netWalletAmount,
          currency: reward.currency,
          memo: `Referral cashout ${reward.id} awaits bank reconciliation evidence.`,
          metadata,
          side: 'CREDIT',
          sourceId: reward.id,
          sourceType,
        },
      ]);
    }
    return [
      ...positiveReferralJournalEntries([
        {
          account: `${owner.type}_WALLET_LIABILITY`,
          amount: withholding.netWalletAmount,
          currency: reward.currency,
          memo: `Referral reversal ${reward.id} decreases ${owner.type.toLowerCase()} wallet liability.`,
          metadata,
          side: 'DEBIT',
          sourceId: reward.id,
          sourceType,
        },
        ...referralWithholdingPayableEntries({
          currency: reward.currency,
          metadata,
          rewardId: reward.id,
          side: 'DEBIT',
          sourceType,
          withholding,
        }),
      ]),
      referralJournalEntry({
        account: `${owner.type}_REFERRAL_REWARD_EXPENSE`,
        amount: reward.amount,
        currency: reward.currency,
        memo: `Referral reversal ${reward.id} reverses prior reward expense.`,
        metadata,
        side: 'CREDIT',
        sourceId: reward.id,
        sourceType,
      }),
    ];
  })();
  const totalDebit = entries
    .filter((entry) => entry.side === 'DEBIT')
    .reduce((total, entry) => total + entry.amount, 0);
  const totalCredit = entries
    .filter((entry) => entry.side === 'CREDIT')
    .reduce((total, entry) => total + entry.amount, 0);
  const batchData = {
    bookingId: reward.qualifyingBookingId ?? null,
    currency: reward.currency,
    customerProfileId: owner.type === 'CUSTOMER' ? owner.id : null,
    entries: {
      create: entries,
    },
    metadata,
    providerProfileId: owner.type === 'PARTNER' ? owner.id : null,
    sourceId: reward.id,
    sourceType,
    status: 'POSTED' as const,
    totalCredit,
    totalDebit,
  };

  await tx.accountingJournalBatch.upsert({
    where: { sourceKey },
    update: {},
    create: {
      ...batchData,
      sourceKey,
    },
  });
}

function referralWithholdingPayableEntries(input: {
  currency: string;
  metadata: Prisma.InputJsonObject;
  rewardId: string;
  side: 'DEBIT' | 'CREDIT';
  sourceType: 'REFERRAL_REWARD';
  withholding: ReturnType<typeof calculateReferralTaxWithholding>;
}) {
  return [
    {
      account: 'REFERRAL_VAT_WITHHOLDING_PAYABLE',
      amount: input.withholding.vatWithheldAmount,
      currency: input.currency,
      memo: `Referral reward ${input.rewardId} VAT withholding payable.`,
      metadata: input.metadata,
      side: input.side,
      sourceId: input.rewardId,
      sourceType: input.sourceType,
    },
    {
      account: 'REFERRAL_PIT_WITHHOLDING_PAYABLE',
      amount: input.withholding.pitWithheldAmount,
      currency: input.currency,
      memo: `Referral reward ${input.rewardId} PIT withholding payable.`,
      metadata: input.metadata,
      side: input.side,
      sourceId: input.rewardId,
      sourceType: input.sourceType,
    },
  ];
}

function positiveReferralJournalEntries(
  entries: Array<{
    account: string;
    amount: number;
    currency: string;
    memo: string;
    metadata: Prisma.InputJsonObject;
    side: 'DEBIT' | 'CREDIT';
    sourceId: string;
    sourceType: 'REFERRAL_REWARD';
  }>,
) {
  return entries.filter((entry) => entry.amount > 0).map(referralJournalEntry);
}

function referralRewardWalletOwner(reward: ReferralRewardLedgerCandidate) {
  if (reward.walletOwnerCustomerProfileId) {
    return { id: reward.walletOwnerCustomerProfileId, type: 'CUSTOMER' as const };
  }
  return { id: reward.walletOwnerProviderProfileId as string, type: 'PARTNER' as const };
}

function referralRewardTaxPolicySnapshot(reward: ReferralRewardLedgerCandidate): ReferralTaxPolicy {
  const snapshot = reward.calculationSnapshot;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) {
    return 'CUSTOMER_SERVICE_CREDIT_ONLY';
  }
  const value = snapshot.taxPolicySnapshot;
  return isReferralTaxPolicy(value) ? value : 'CUSTOMER_SERVICE_CREDIT_ONLY';
}

function isReferralTaxPolicy(value: unknown): value is ReferralTaxPolicy {
  return (
    value === 'NONE' ||
    value === 'CUSTOMER_SERVICE_CREDIT_ONLY' ||
    value === 'INDIVIDUAL_COMMISSION_PIT_10' ||
    value === 'BUSINESS_SERVICE_VAT5_PIT2' ||
    value === 'NON_RESIDENT_MANUAL_REVIEW' ||
    value === 'MANUAL_REVIEW'
  );
}

function referralJournalEntry(input: {
  account: string;
  amount: number;
  currency: string;
  memo: string;
  metadata: Prisma.InputJsonObject;
  side: 'DEBIT' | 'CREDIT';
  sourceId: string;
  sourceType: 'REFERRAL_REWARD';
}) {
  return {
    accountCode: referralJournalAccountCode(input.account),
    accountName: referralJournalAccountName(input.account),
    amount: input.amount,
    currency: input.currency,
    memo: input.memo,
    metadata: input.metadata,
    side: input.side,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
  };
}

function referralJournalAccountCode(value: string) {
  return value.trim().toLowerCase();
}

function referralJournalAccountName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function referralRewardSourceKey(audience: ReferralAudience, attributionId: string, bookingId: string) {
  return `referral:${audience}:${attributionId}:${bookingId}`;
}

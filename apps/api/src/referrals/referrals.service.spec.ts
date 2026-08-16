import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  BookingSettlementStatus,
  BookingStatus,
  PaymentStatus,
  Prisma,
  ReferralAttributionStatus,
  ReferralAudience,
  ReferralFraudReviewStatus,
  ReferralRewardMode,
  ReferralRewardStatus,
} from '@prisma/client';
import { ReferralsService } from './referrals.service';

function createService(prisma: unknown, notifications?: unknown) {
  const testPrisma = prisma as {
    $queryRaw?: (...args: unknown[]) => Promise<unknown>;
    $transaction?: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown>;
  };
  testPrisma.$queryRaw ??= vi.fn().mockResolvedValue([]);
  testPrisma.$transaction ??= vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(testPrisma));
  return new ReferralsService(testPrisma as never, notifications as never);
}

const referralRewardUpdatedAt = new Date('2026-08-10T10:00:00.000Z');

function expectedRewardState(status: ReferralRewardStatus, updatedAt = referralRewardUpdatedAt) {
  return { expectedStatus: status, expectedUpdatedAt: updatedAt.toISOString() };
}

function creditableReward<T extends {
  amount: number;
  calculationSnapshot?: Record<string, unknown>;
  qualifyingBookingId: string;
  walletOwnerCustomerProfileId: string | null;
  walletOwnerProviderProfileId: string | null;
}>(reward: T) {
  const audience = reward.walletOwnerCustomerProfileId ? ReferralAudience.CUSTOMER : ReferralAudience.PARTNER;
  const selectedProviderId = 'qualifying-provider-profile';
  const customerProfileId = 'qualifying-customer-profile';
  return {
    ...reward,
    availableAt: new Date('2020-06-24T10:00:00.000Z'),
    updatedAt: referralRewardUpdatedAt,
    attribution: {
      audience,
      fraudReviewStatus: ReferralFraudReviewStatus.CLEAR,
      referrerCustomerProfileId: reward.walletOwnerCustomerProfileId,
      referrerProviderProfileId: reward.walletOwnerProviderProfileId,
      status: ReferralAttributionStatus.QUALIFIED,
    },
    calculationSnapshot: {
      ...reward.calculationSnapshot,
      audience,
      bookingId: reward.qualifyingBookingId,
      rewardAmountSnapshot: reward.amount,
      rewardMode:
        audience === ReferralAudience.CUSTOMER
          ? ReferralRewardMode.COMMISSION_PERCENT
          : ReferralRewardMode.FIXED_AMOUNT,
    },
    qualifyingBooking: {
      customerProfileId,
      earning: { id: `earning:${reward.qualifyingBookingId}` },
      id: reward.qualifyingBookingId,
      payment: { method: 'CARD', status: PaymentStatus.CAPTURED },
      refunds: [],
      selectedProviderId,
      settlementSnapshot: {
        customerProfileId,
        providerProfileId: selectedProviderId,
        reversedById: null,
        settlementStatus: BookingSettlementStatus.POSTED,
      },
      status: BookingStatus.COMPLETED,
    },
  };
}

const creditedReferralRewardStatus = 'CREDITED' as ReferralRewardStatus;
const cashoutApprovedReferralRewardStatus = 'CASHOUT_APPROVED' as ReferralRewardStatus;
const cashoutRequestedReferralRewardStatus = 'CASHOUT_REQUESTED' as ReferralRewardStatus;
const paidReferralRewardStatus = 'PAID' as ReferralRewardStatus;
const taxReviewRequiredReferralRewardStatus = 'TAX_REVIEW_REQUIRED' as ReferralRewardStatus;

describe('ReferralsService', () => {
  it('returns an existing customer referral code without creating a new one', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
          createdAt,
          updatedAt: createdAt,
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.getCustomerReferralCode('user-1')).resolves.toEqual({
      id: 'code-1',
      active: true,
      audience: ReferralAudience.CUSTOMER,
      code: 'HCUSTOMER',
      sharePath: '/r/customer/HCUSTOMER',
      createdAt,
      updatedAt: createdAt,
    });
    expect(prisma.referralCode.create).not.toHaveBeenCalled();
  });

  it('returns null when a customer profile exists but has no referral code yet', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getCustomerReferralCode('user-1')).resolves.toBeNull();
  });

  it('summarizes customer referral code and reward totals without listing every customer', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralAttribution: {
        count: vi.fn().mockResolvedValue(2),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
          createdAt,
          updatedAt: createdAt,
        }),
      },
      referralPolicy: {
        findUnique: vi.fn().mockResolvedValue({
          audience: ReferralAudience.CUSTOMER,
          commissionPercentBps: 1_000,
          currency: 'VND',
          enabled: true,
          fixedRewardAmount: null,
          holdPeriodDays: 7,
          maxRewardedReferrals: 10,
          maxRewardsPerReferred: 1,
          metadata: null,
          perRewardCapAmount: 100_000,
          rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
          totalRewardCapAmount: 1_000_000,
        }),
      },
      referralReward: {
        groupBy: vi.fn().mockResolvedValue([
          { status: 'PENDING', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 25_000 } },
          { status: 'AVAILABLE', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 75_000 } },
          { status: 'REWARDED', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 50_000 } },
          { status: 'CREDITED', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 35_000 } },
        ]),
      },
    };
    const service = createService(prisma);

    await expect(service.getCustomerReferralSummary('user-1')).resolves.toEqual({
      policy: {
        commissionPercentBps: 1_000,
        currency: 'VND',
        enabled: true,
        fixedRewardAmount: null,
        holdPeriodDays: 7,
        maxRewardedReferrals: 10,
        maxRewardsPerReferred: 1,
        perRewardCapAmount: 100_000,
        rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
        totalRewardCapAmount: 1_000_000,
      },
      referralCode: {
        id: 'code-1',
        active: true,
        audience: ReferralAudience.CUSTOMER,
        code: 'HCUSTOMER',
        sharePath: '/r/customer/HCUSTOMER',
        createdAt,
        updatedAt: createdAt,
      },
      totals: {
        availableAmount: 75_000,
        cancelledAmount: 0,
        currency: 'VND',
        heldAmount: 0,
        invitedFriendCount: 2,
        paidOutAmount: 0,
        pendingAmount: 25_000,
        processingAmount: 185_000,
        referralCount: 2,
        rewardedAmount: 85_000,
        reversedAmount: 0,
        rewardCount: 4,
        totalRewardAmount: 185_000,
      },
    });
    expect(prisma.referralAttribution.count).toHaveBeenCalledWith({
      where: {
        audience: ReferralAudience.CUSTOMER,
        referrerCustomerProfileId: 'customer-profile-1',
      },
    });
    expect(prisma.referralReward.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status', 'currency'],
        where: { walletOwnerCustomerProfileId: 'customer-profile-1' },
      }),
    );
  });

  it('lists owned referral invites with masked customer identity and cursor pagination', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralAttribution: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'invite-1',
            status: 'QUALIFIED',
            createdAt,
            updatedAt: createdAt,
            referredCustomerProfile: {
              user: { fullName: 'Nguyen Van An', phone: '+84 912 345 678' },
            },
            _count: { rewards: 1 },
          },
          {
            id: 'invite-2',
            status: 'REGISTERED',
            createdAt,
            updatedAt: createdAt,
            referredCustomerProfile: {
              user: { fullName: null, phone: '+84 987 654 321' },
            },
            _count: { rewards: 0 },
          },
        ]),
      },
    };
    const service = createService(prisma);

    const result = await service.listCustomerReferralInvites('user-1', { limit: 1 });

    expect(result).toEqual({
      rows: [
        {
          id: 'invite-1',
          displayName: 'N*** V** A*',
          status: 'QUALIFIED',
          attributedAt: createdAt,
          updatedAt: createdAt,
          rewardConditionMet: true,
        },
      ],
      pagination: { nextCursor: 'invite-1' },
    });
    expect(JSON.stringify(result)).not.toContain('Nguyen Van An');
    expect(JSON.stringify(result)).not.toContain('912345678');
    expect(prisma.referralAttribution.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 2,
        where: {
          audience: ReferralAudience.CUSTOMER,
          referrerCustomerProfileId: 'customer-profile-1',
        },
      }),
    );
  });

  it('lists owned rewards without raw booking ids and exposes server cashout eligibility', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 50_000 } }),
      },
      referralReward: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'reward-1',
            amount: 50_000,
            availableAt: createdAt,
            calculationSnapshot: {},
            createdAt,
            currency: 'VND',
            qualifyingBookingId: 'booking-123456789',
            sourceKey: 'referral:CUSTOMER:invite-1:booking-123456789',
            status: creditedReferralRewardStatus,
            walletLedgerReference: 'ledger-1',
            walletOwnerCustomerProfileId: 'customer-profile-1',
            walletOwnerProviderProfileId: null,
          },
        ]),
      },
    };
    const service = createService(prisma);

    const result = await service.listCustomerReferralRewards('user-1');

    expect(result).toEqual({
      rows: [
        {
          id: 'reward-1',
          amount: 50_000,
          availableAt: createdAt,
          bookingReference: 'HANDS-23456789',
          canRequestCashout: true,
          cashoutUnavailableReason: null,
          cashoutAmount: 50_000,
          createdAt,
          currency: 'VND',
          status: creditedReferralRewardStatus,
        },
      ],
      pagination: { nextCursor: null },
    });
    expect(JSON.stringify(result)).not.toContain('booking-123456789');
    expect(prisma.referralReward.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { walletOwnerCustomerProfileId: 'customer-profile-1' },
      }),
    );
  });

  it('creates a customer referral code only through the issue action', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        create: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HC2D1B20B37',
          createdAt,
          updatedAt: createdAt,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      referralPolicy: {
        findUnique: vi.fn().mockResolvedValue({
          audience: ReferralAudience.CUSTOMER,
          commissionPercentBps: 1_000,
          currency: 'VND',
          enabled: true,
          fixedRewardAmount: null,
          holdPeriodDays: 7,
          maxRewardedReferrals: null,
          maxRewardsPerReferred: null,
          metadata: null,
          perRewardCapAmount: null,
          rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
          totalRewardCapAmount: null,
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.issueCustomerReferralCode('user-1')).resolves.toMatchObject({
      audience: ReferralAudience.CUSTOMER,
      sharePath: '/r/customer/HC2D1B20B37',
    });
    expect(prisma.referralCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audience: ReferralAudience.CUSTOMER,
          ownerCustomerProfileId: 'customer-profile-1',
        }),
      }),
    );
  });

  it('does not issue a new customer referral code while the policy is disabled', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      referralPolicy: {
        findUnique: vi.fn().mockResolvedValue({ enabled: false }),
      },
    };
    const service = createService(prisma);

    await expect(service.issueCustomerReferralCode('user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.referralCode.create).not.toHaveBeenCalled();
  });

  it('claims a customer referral code once for the signed-in customer profile', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'referred-customer-1' }),
      },
      referralAttribution: {
        create: vi.fn().mockResolvedValue({
          id: 'attribution-1',
          audience: ReferralAudience.CUSTOMER,
          referralCodeId: 'code-1',
          referrerCustomerProfileId: 'referrer-customer-1',
          referredCustomerProfileId: 'referred-customer-1',
          installSource: 'referral-link',
          platform: 'android',
          status: 'REGISTERED',
          fraudReviewStatus: 'CLEAR',
          createdAt,
          updatedAt: createdAt,
          referralCode: { id: 'code-1', code: 'HCUSTOMER' },
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
          ownerCustomerProfileId: 'referrer-customer-1',
        }),
      },
      referralPolicy: {
        findUnique: vi.fn().mockResolvedValue({
          audience: ReferralAudience.CUSTOMER,
          commissionPercentBps: 1_000,
          currency: 'VND',
          enabled: true,
          fixedRewardAmount: null,
          holdPeriodDays: 7,
          maxRewardedReferrals: null,
          maxRewardsPerReferred: null,
          metadata: null,
          perRewardCapAmount: null,
          rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
          totalRewardCapAmount: null,
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.claimCustomerReferralCode('user-1', {
        code: ' hcustomer ',
        installSource: ' referral-link ',
        platform: ' android ',
      }),
    ).resolves.toMatchObject({
      id: 'attribution-1',
      audience: ReferralAudience.CUSTOMER,
      referralCode: { code: 'HCUSTOMER' },
      referrerCustomerProfileId: 'referrer-customer-1',
      referredCustomerProfileId: 'referred-customer-1',
    });
    expect(prisma.referralCode.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
        }),
      }),
    );
    expect(prisma.referralAttribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audience: ReferralAudience.CUSTOMER,
          installSource: 'referral-link',
          platform: 'android',
          referredCustomerProfileId: 'referred-customer-1',
          referrerCustomerProfileId: 'referrer-customer-1',
        }),
      }),
    );
  });

  it('rejects customer referral claims with unsupported platforms before writing attribution', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'referred-customer-1' }),
      },
      referralAttribution: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
          ownerCustomerProfileId: 'referrer-customer-1',
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.claimCustomerReferralCode('user-1', {
        code: 'HCUSTOMER',
        platform: ' blackberry ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.referralCode.findFirst).not.toHaveBeenCalled();
    expect(prisma.referralAttribution.create).not.toHaveBeenCalled();
  });

  it('returns the existing customer referral attribution without creating a duplicate', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'referred-customer-1' }),
      },
      referralAttribution: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue({
          id: 'attribution-1',
          audience: ReferralAudience.CUSTOMER,
          referralCodeId: 'code-1',
          referrerCustomerProfileId: 'referrer-customer-1',
          referredCustomerProfileId: 'referred-customer-1',
          status: 'REGISTERED',
          fraudReviewStatus: 'CLEAR',
          createdAt,
          updatedAt: createdAt,
          referralCode: { id: 'code-1', code: 'HCUSTOMER' },
        }),
      },
      referralCode: {
        findFirst: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(service.claimCustomerReferralCode('user-1', { code: 'HCUSTOMER' })).resolves.toMatchObject({
      id: 'attribution-1',
      referralCode: { code: 'HCUSTOMER' },
    });
    expect(prisma.referralCode.findFirst).not.toHaveBeenCalled();
    expect(prisma.referralAttribution.create).not.toHaveBeenCalled();
  });

  it('rejects customer self-referral claims', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralAttribution: {
        create: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
          ownerCustomerProfileId: 'customer-profile-1',
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.claimCustomerReferralCode('user-1', { code: 'HCUSTOMER' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.referralAttribution.create).not.toHaveBeenCalled();
  });

  it('creates a Partner referral code with Partner owner linkage', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      referralCode: {
        create: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.PARTNER,
          code: 'HP2D1B20B37',
          createdAt,
          updatedAt: createdAt,
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.issuePartnerReferralCode('user-1')).resolves.toMatchObject({
      audience: ReferralAudience.PARTNER,
      sharePath: '/r/partner/HP2D1B20B37',
    });
    expect(prisma.referralCode.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audience: ReferralAudience.PARTNER,
          ownerProviderProfileId: 'provider-profile-1',
        }),
      }),
    );
  });

  it('claims a Partner referral code once for the signed-in Partner profile', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'referred-partner-1' }),
      },
      referralAttribution: {
        create: vi.fn().mockResolvedValue({
          id: 'attribution-1',
          audience: ReferralAudience.PARTNER,
          referralCodeId: 'code-1',
          referrerProviderProfileId: 'referrer-partner-1',
          referredProviderProfileId: 'referred-partner-1',
          installSource: 'referral-link',
          platform: 'ios',
          status: 'REGISTERED',
          fraudReviewStatus: 'CLEAR',
          createdAt,
          updatedAt: createdAt,
          referralCode: { id: 'code-1', code: 'HPARTNER' },
        }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.PARTNER,
          code: 'HPARTNER',
          ownerProviderProfileId: 'referrer-partner-1',
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.claimPartnerReferralCode('user-1', {
        code: ' hpartner ',
        installSource: ' referral-link ',
        platform: ' ios ',
      }),
    ).resolves.toMatchObject({
      id: 'attribution-1',
      audience: ReferralAudience.PARTNER,
      referralCode: { code: 'HPARTNER' },
      referrerProviderProfileId: 'referrer-partner-1',
      referredProviderProfileId: 'referred-partner-1',
    });
    expect(prisma.referralAttribution.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          audience: ReferralAudience.PARTNER,
          installSource: 'referral-link',
          platform: 'ios',
          referredProviderProfileId: 'referred-partner-1',
          referrerProviderProfileId: 'referrer-partner-1',
        }),
      }),
    );
  });

  it('summarizes Partner referral code and reward totals without listing every Partner', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      referralAttribution: {
        count: vi.fn().mockResolvedValue(3),
      },
      referralCode: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.PARTNER,
          code: 'HPARTNER',
          createdAt,
          updatedAt: createdAt,
        }),
      },
      referralReward: {
        groupBy: vi.fn().mockResolvedValue([
          { status: 'HELD', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 100_000 } },
          { status: 'REWARDED', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 75_000 } },
          { status: 'CREDITED', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 300_000 } },
        ]),
      },
    };
    const service = createService(prisma);

    await expect(service.getPartnerReferralSummary('user-1')).resolves.toEqual({
      referralCode: {
        id: 'code-1',
        active: true,
        audience: ReferralAudience.PARTNER,
        code: 'HPARTNER',
        sharePath: '/r/partner/HPARTNER',
        createdAt,
        updatedAt: createdAt,
      },
      totals: {
        availableAmount: 0,
        cancelledAmount: 0,
        currency: 'VND',
        heldAmount: 100_000,
        pendingAmount: 0,
        referralCount: 3,
        rewardedAmount: 375_000,
        reversedAmount: 0,
        rewardCount: 3,
      },
    });
    expect(prisma.referralAttribution.count).toHaveBeenCalledWith({
      where: {
        audience: ReferralAudience.PARTNER,
        referrerProviderProfileId: 'provider-profile-1',
      },
    });
    expect(prisma.referralReward.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['status', 'currency'],
        where: { walletOwnerProviderProfileId: 'provider-profile-1' },
      }),
    );
  });

  it('creates a pending customer referral reward from completed booking platform fee', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const availableAt = new Date('2026-06-29T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'referred-customer-1',
          selectedProviderId: 'provider-1',
          updatedAt: createdAt,
          earning: {
            id: 'earning-1',
            grossAmount: 1_000_000,
            platformFee: 200_000,
            currency: 'VND',
          },
        }),
      },
      providerEarning: {
        count: vi.fn().mockResolvedValue(1),
      },
      referralAttribution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'customer-attribution-1',
            audience: ReferralAudience.CUSTOMER,
            referrerCustomerProfileId: 'referrer-customer-1',
            referredCustomerProfileId: 'referred-customer-1',
          })
          .mockResolvedValueOnce(null),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            audience: ReferralAudience.CUSTOMER,
            enabled: true,
            rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
            commissionPercentBps: 1_000,
            fixedRewardAmount: null,
            perRewardCapAmount: 15_000,
            maxRewardedReferrals: 5,
            holdPeriodDays: 5,
            currency: 'VND',
          })
          .mockResolvedValueOnce(null),
      },
      referralReward: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 15_000,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
          availableAt,
        }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-1')).resolves.toMatchObject({
      customerReward: {
        id: 'reward-1',
        amount: 15_000,
        sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
      },
      partnerReward: null,
    });
    expect(prisma.referralReward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 15_000,
          attributionId: 'customer-attribution-1',
          qualifyingBookingId: 'booking-1',
          sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
          status: ReferralRewardStatus.PENDING,
          walletOwnerCustomerProfileId: 'referrer-customer-1',
        }),
      }),
    );
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('creates a capped fixed customer reward when the active policy uses a fixed amount', async () => {
    const completedAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-fixed-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'referred-customer-1',
          selectedProviderId: 'provider-1',
          updatedAt: completedAt,
          earning: {
            id: 'earning-fixed-1',
            grossAmount: 1_000_000,
            platformFee: 200_000,
            currency: 'VND',
          },
        }),
      },
      referralAttribution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'customer-attribution-fixed-1',
            audience: ReferralAudience.CUSTOMER,
            referrerCustomerProfileId: 'referrer-customer-1',
            referredCustomerProfileId: 'referred-customer-1',
          })
          .mockResolvedValueOnce(null),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            audience: ReferralAudience.CUSTOMER,
            enabled: true,
            rewardMode: ReferralRewardMode.FIXED_AMOUNT,
            commissionPercentBps: null,
            fixedRewardAmount: 40_000,
            perRewardCapAmount: 35_000,
            totalRewardCapAmount: null,
            maxRewardedReferrals: null,
            maxRewardsPerReferred: null,
            holdPeriodDays: 0,
            currency: 'VND',
            metadata: null,
          })
          .mockResolvedValueOnce(null),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'reward-fixed-1',
          amount: 35_000,
          availableAt: completedAt,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:customer-attribution-fixed-1:booking-fixed-1',
          status: ReferralRewardStatus.PENDING,
          walletLedgerReference: null,
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-fixed-1')).resolves.toMatchObject({
      customerReward: { amount: 35_000 },
      partnerReward: null,
    });
    expect(prisma.referralReward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 35_000,
          walletOwnerCustomerProfileId: 'referrer-customer-1',
        }),
      }),
    );
  });

  it('creates customer and Partner rewards in one serializable transaction', async () => {
    const completedAt = new Date('2026-06-24T10:00:00.000Z');
    const transaction = vi.fn();
    const prisma = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: transaction,
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-paired-reward-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'referred-customer-1',
          selectedProviderId: 'referred-partner-1',
          updatedAt: completedAt,
          earning: {
            id: 'earning-paired-reward-1',
            grossAmount: 1_000_000,
            platformFee: 200_000,
            currency: 'VND',
          },
        }),
      },
      providerEarning: {
        count: vi.fn().mockResolvedValue(0),
      },
      referralAttribution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'customer-attribution-paired-1',
            audience: ReferralAudience.CUSTOMER,
            referrerCustomerProfileId: 'referrer-customer-1',
            referredCustomerProfileId: 'referred-customer-1',
            referrerProviderProfileId: null,
            referredProviderProfileId: null,
          })
          .mockResolvedValueOnce({
            id: 'partner-attribution-paired-1',
            audience: ReferralAudience.PARTNER,
            referrerCustomerProfileId: null,
            referredCustomerProfileId: null,
            referrerProviderProfileId: 'referrer-partner-1',
            referredProviderProfileId: 'referred-partner-1',
          }),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            audience: ReferralAudience.CUSTOMER,
            enabled: true,
            rewardMode: ReferralRewardMode.FIXED_AMOUNT,
            commissionPercentBps: null,
            fixedRewardAmount: 20_000,
            perRewardCapAmount: null,
            totalRewardCapAmount: null,
            maxRewardedReferrals: null,
            maxRewardsPerReferred: null,
            holdPeriodDays: 0,
            currency: 'VND',
            metadata: null,
          })
          .mockResolvedValueOnce({
            audience: ReferralAudience.PARTNER,
            enabled: true,
            rewardMode: ReferralRewardMode.FIXED_AMOUNT,
            commissionPercentBps: null,
            fixedRewardAmount: 80_000,
            perRewardCapAmount: null,
            totalRewardCapAmount: null,
            maxRewardedReferrals: null,
            maxRewardsPerReferred: null,
            holdPeriodDays: 0,
            currency: 'VND',
            metadata: null,
          }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }: { data: { amount: number; sourceKey: string } }) => ({
          id: `reward-${data.sourceKey}`,
          amount: data.amount,
          sourceKey: data.sourceKey,
        })),
      },
    };
    transaction.mockImplementation(
      async (callback: (transactionClient: typeof prisma) => Promise<unknown>) => callback(prisma),
    );
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-paired-reward-1')).resolves.toMatchObject({
      customerReward: {
        amount: 20_000,
        sourceKey: 'referral:CUSTOMER:customer-attribution-paired-1:booking-paired-reward-1',
      },
      partnerReward: {
        amount: 80_000,
        sourceKey: 'referral:PARTNER:partner-attribution-paired-1:booking-paired-reward-1',
      },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
    );
    expect(prisma.referralReward.create).toHaveBeenCalledTimes(2);
  });

  it('caps customer referral reward by remaining lifetime reward allowance', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'referred-customer-1',
          selectedProviderId: 'provider-1',
          updatedAt: createdAt,
          earning: {
            id: 'earning-1',
            grossAmount: 1_000_000,
            platformFee: 200_000,
            currency: 'VND',
          },
        }),
      },
      referralAttribution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'customer-attribution-1',
            audience: ReferralAudience.CUSTOMER,
            referrerCustomerProfileId: 'referrer-customer-1',
            referredCustomerProfileId: 'referred-customer-1',
          })
          .mockResolvedValueOnce(null),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            audience: ReferralAudience.CUSTOMER,
            enabled: true,
            rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
            commissionPercentBps: 1_000,
            fixedRewardAmount: null,
            perRewardCapAmount: null,
            totalRewardCapAmount: 500_000,
            maxRewardedReferrals: 10,
            holdPeriodDays: 5,
            currency: 'VND',
          })
          .mockResolvedValueOnce(null),
      },
      referralReward: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 490_000 } }),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 10_000,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
        }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-1')).resolves.toMatchObject({
      customerReward: {
        amount: 10_000,
      },
      partnerReward: null,
    });
    expect(prisma.referralReward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 10_000,
        }),
      }),
    );
  });

  it('calculates customer referral rewards from platform fee net revenue after company output VAT', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'referred-customer-1',
          selectedProviderId: 'provider-1',
          updatedAt: createdAt,
          earning: {
            id: 'earning-1',
            grossAmount: 640_000,
            platformFee: 128_000,
            currency: 'VND',
          },
        }),
      },
      referralAttribution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'customer-attribution-1',
            audience: ReferralAudience.CUSTOMER,
            referrerCustomerProfileId: 'referrer-customer-1',
            referredCustomerProfileId: 'referred-customer-1',
          })
          .mockResolvedValueOnce(null),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            audience: ReferralAudience.CUSTOMER,
            enabled: true,
            rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
            commissionPercentBps: 3_000,
            fixedRewardAmount: null,
            perRewardCapAmount: null,
            totalRewardCapAmount: null,
            maxRewardedReferrals: 10,
            maxRewardsPerReferred: 1,
            holdPeriodDays: 5,
            currency: 'VND',
            metadata: { platformFeeVatRateBps: 800 },
          })
          .mockResolvedValueOnce(null),
      },
      referralReward: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 35_556,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
        }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-1')).resolves.toMatchObject({
      customerReward: {
        amount: 35_556,
      },
      partnerReward: null,
    });
    expect(prisma.referralReward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 35_556,
          calculationSnapshot: expect.objectContaining({
            basePlatformFee: 128_000,
            platformFeeNetRevenue: 118_519,
            platformFeeVatRateBps: 800,
            rewardRateSnapshotBps: 3_000,
          }),
        }),
      }),
    );
  });

  it('skips customer referral reward when the referred account reward count is already capped', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-2',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'referred-customer-1',
          selectedProviderId: 'provider-1',
          updatedAt: createdAt,
          earning: {
            id: 'earning-2',
            grossAmount: 1_000_000,
            platformFee: 200_000,
            currency: 'VND',
          },
        }),
      },
      referralAttribution: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'customer-attribution-1',
            audience: ReferralAudience.CUSTOMER,
            referrerCustomerProfileId: 'referrer-customer-1',
            referredCustomerProfileId: 'referred-customer-1',
          })
          .mockResolvedValueOnce(null),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce({
            audience: ReferralAudience.CUSTOMER,
            enabled: true,
            rewardMode: ReferralRewardMode.COMMISSION_PERCENT,
            commissionPercentBps: 1_000,
            fixedRewardAmount: null,
            perRewardCapAmount: null,
            totalRewardCapAmount: null,
            maxRewardedReferrals: 10,
            maxRewardsPerReferred: 1,
            holdPeriodDays: 5,
            currency: 'VND',
          })
          .mockResolvedValueOnce(null),
      },
      referralReward: {
        count: vi.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-2')).resolves.toEqual({
      customerReward: null,
      partnerReward: null,
    });
    expect(prisma.referralReward.create).not.toHaveBeenCalled();
  });

  it('releases pending referral rewards after the configured hold window', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const service = createService(prisma);

    await expect(service.releaseAvailableRewards(now)).resolves.toEqual({ releasedCount: 2 });
    expect(prisma.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: ReferralRewardStatus.AVAILABLE },
      where: {
        NOT: expect.objectContaining({ OR: expect.any(Array) }),
        availableAt: { lte: now },
        status: ReferralRewardStatus.PENDING,
      },
    });
  });

  it('holds an uncredited pending reward candidate', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: ReferralRewardStatus.PENDING,
          updatedAt: referralRewardUpdatedAt,
          walletLedgerReference: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 25000,
          availableAt: now,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:attr-1:booking-1',
          status: ReferralRewardStatus.HELD,
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.holdRewardCandidate('reward-1', expectedRewardState(ReferralRewardStatus.PENDING)),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.HELD,
    });
    expect(prisma.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: ReferralRewardStatus.HELD },
      where: { id: 'reward-1', status: ReferralRewardStatus.PENDING, updatedAt: referralRewardUpdatedAt },
    });
  });

  it('releases a held reward to available using the loaded state version', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const heldReward = creditableReward({
      id: 'reward-held-1',
      amount: 25_000,
      currency: 'VND',
      qualifyingBookingId: 'booking-held-1',
      sourceKey: 'referral:CUSTOMER:attr-held:booking-held-1',
      status: ReferralRewardStatus.HELD,
      walletLedgerReference: null,
      walletOwnerCustomerProfileId: 'customer-parent-held-1',
      walletOwnerProviderProfileId: null,
    });
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(heldReward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'reward-held-1',
          amount: 25_000,
          availableAt: now,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:attr-held:booking-1',
          status: ReferralRewardStatus.AVAILABLE,
          updatedAt: new Date('2026-08-10T10:01:00.000Z'),
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.releaseHeldRewardCandidate('reward-held-1', expectedRewardState(ReferralRewardStatus.HELD)),
    ).resolves.toMatchObject({ id: 'reward-held-1', status: ReferralRewardStatus.AVAILABLE });
    expect(prisma.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: ReferralRewardStatus.AVAILABLE },
      where: { id: 'reward-held-1', status: ReferralRewardStatus.HELD, updatedAt: referralRewardUpdatedAt },
    });
  });

  it('retries serializable reward transitions after transient transaction conflicts', async () => {
    const heldReward = creditableReward({
      id: 'reward-held-retry',
      amount: 25_000,
      currency: 'VND',
      qualifyingBookingId: 'booking-held-retry',
      sourceKey: 'referral:CUSTOMER:attr-held-retry:booking-held-retry',
      status: ReferralRewardStatus.HELD,
      walletLedgerReference: null,
      walletOwnerCustomerProfileId: 'customer-parent-held-retry',
      walletOwnerProviderProfileId: null,
    });
    const tx = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(heldReward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          ...heldReward,
          status: ReferralRewardStatus.AVAILABLE,
        }),
      },
    };
    const serializationFailure = () => new Prisma.PrismaClientKnownRequestError(
      'Transaction conflict',
      { clientVersion: 'test', code: 'P2034' },
    );
    const prisma = {
      $transaction: vi
        .fn()
        .mockRejectedValueOnce(serializationFailure())
        .mockRejectedValueOnce(serializationFailure())
        .mockImplementationOnce(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = createService(prisma);

    await expect(
      service.releaseHeldRewardCandidate(
        heldReward.id,
        expectedRewardState(ReferralRewardStatus.HELD),
      ),
    ).resolves.toMatchObject({ status: ReferralRewardStatus.AVAILABLE });
    expect(prisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it('blocks a held reward release when qualifying booking evidence is missing', async () => {
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          ...creditableReward({
            id: 'reward-held-missing-booking',
            amount: 25_000,
            currency: 'VND',
            qualifyingBookingId: 'booking-held-missing',
            sourceKey: 'referral:CUSTOMER:attr-held-missing:booking-held-missing',
            status: ReferralRewardStatus.HELD,
            walletLedgerReference: null,
            walletOwnerCustomerProfileId: 'customer-parent-held-missing',
            walletOwnerProviderProfileId: null,
          }),
          qualifyingBookingId: null,
          qualifyingBooking: null,
        }),
        updateMany: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.releaseHeldRewardCandidate(
        'reward-held-missing-booking',
        expectedRewardState(ReferralRewardStatus.HELD),
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'QUALIFYING_BOOKING_MISSING' }),
      status: 409,
    });
    expect(prisma.referralReward.updateMany).not.toHaveBeenCalled();
  });

  it('blocks fixture reward state and wallet mutations', async () => {
    const fixtureReward = {
      ...creditableReward({
        id: 'reward-fixture-1',
        amount: 25_000,
        currency: 'VND',
        qualifyingBookingId: 'booking-fixture-1',
        sourceKey: 'referral:CUSTOMER:attr-fixture:booking-fixture-1',
        status: ReferralRewardStatus.AVAILABLE,
        walletLedgerReference: null,
        walletOwnerCustomerProfileId: 'customer-fixture-1',
        walletOwnerProviderProfileId: null,
      }),
      metadata: { smoke: 'referral-admin' },
    };
    const tx = {
      customerWalletLedgerEntry: { findUnique: vi.fn(), upsert: vi.fn() },
      providerWalletLedgerEntry: { findUnique: vi.fn(), upsert: vi.fn() },
      referralReward: { findUnique: vi.fn().mockResolvedValue(fixtureReward), updateMany: vi.fn() },
    };
    const service = createService({
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    });

    await expect(
      service.creditRewardCandidate('reward-fixture-1', expectedRewardState(ReferralRewardStatus.AVAILABLE)),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'REFERRAL_FIXTURE_MUTATION_BLOCKED' }),
      status: 409,
    });
    expect(tx.referralReward.updateMany).not.toHaveBeenCalled();
    expect(tx.customerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
  });

  it('rejects a reward decision when the loaded state version is stale', async () => {
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-stale-1',
          status: ReferralRewardStatus.PENDING,
          updatedAt: new Date('2026-08-10T10:05:00.000Z'),
          walletLedgerReference: null,
        }),
        updateMany: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.holdRewardCandidate('reward-stale-1', expectedRewardState(ReferralRewardStatus.PENDING)),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.referralReward.updateMany).not.toHaveBeenCalled();
  });

  it('rejects reward candidate state changes after wallet credit exists', async () => {
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: ReferralRewardStatus.AVAILABLE,
          updatedAt: referralRewardUpdatedAt,
          walletLedgerReference: 'wallet-ledger-1',
        }),
        update: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(
      service.reverseRewardCandidate('reward-1', expectedRewardState(ReferralRewardStatus.AVAILABLE)),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.referralReward.update).not.toHaveBeenCalled();
  });

  it('reverses credited referral rewards with wallet and journal reversal entries', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = creditableReward({
      id: 'reward-credited-1',
      amount: 25_000,
      calculationSnapshot: { taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY' },
      currency: 'VND',
      qualifyingBookingId: 'booking-1',
      sourceKey: 'referral:CUSTOMER:attribution-1:booking-1',
      status: creditedReferralRewardStatus,
      updatedAt: referralRewardUpdatedAt,
      walletLedgerReference: 'customer-earned-ledger-1',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    });
    const ledger = { id: 'customer-reversal-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      providerWalletLedgerEntry: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-reversal-journal-1' }),
      },
      referralReward: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          availableAt: now,
          status: ReferralRewardStatus.REVERSED,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.reverseRewardCandidate('reward-credited-1', expectedRewardState(creditedReferralRewardStatus)),
    ).resolves.toMatchObject({
      id: 'reward-credited-1',
      status: ReferralRewardStatus.REVERSED,
      walletLedgerReference: 'customer-reversal-ledger-1',
    });
    expect(tx.customerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-reversal:reward-credited-1' },
        create: expect.objectContaining({
          amount: -25_000,
          bookingId: 'booking-1',
          currency: 'VND',
          customerProfileId: 'customer-profile-1',
          referralRewardId: 'reward-credited-1',
          reference: 'referral:CUSTOMER:attribution-1:booking-1',
          sourceKey: 'referral:wallet-reversal:reward-credited-1',
          type: 'CUSTOMER_REFERRAL_REVERSED',
        }),
        update: {},
      }),
    );
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:referral-wallet-reversal:reward-credited-1' },
      update: {},
      create: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceKey: 'accounting-journal:referral-wallet-reversal:reward-credited-1',
        sourceId: 'reward-credited-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
    });
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: ReferralRewardStatus.REVERSED,
        walletLedgerReference: 'customer-reversal-ledger-1',
      },
      where: { id: 'reward-credited-1', status: ReferralRewardStatus.LOCKED },
      select: expect.any(Object),
    });
  });

  it('reverses withheld referral rewards by restoring wallet and withholding payable balances', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
      id: 'reward-withheld-reversal-1',
      amount: 100_000,
      calculationSnapshot: { taxPolicySnapshot: 'INDIVIDUAL_COMMISSION_PIT_10' },
      currency: 'VND',
      qualifyingBookingId: 'booking-withheld-reversal-1',
      sourceKey: 'referral:PARTNER:attribution-withheld-reversal:booking-withheld-reversal-1',
      status: creditedReferralRewardStatus,
      updatedAt: referralRewardUpdatedAt,
      walletLedgerReference: 'provider-earned-ledger-withheld-1',
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    };
    const ledger = { id: 'provider-reversal-ledger-withheld-1' };
    const tx = {
      customerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-withheld-reversal-journal-1' }),
      },
      referralReward: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          availableAt: now,
          status: ReferralRewardStatus.REVERSED,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.reverseRewardCandidate(
        'reward-withheld-reversal-1',
        expectedRewardState(creditedReferralRewardStatus),
      ),
    ).resolves.toMatchObject({
      id: 'reward-withheld-reversal-1',
      status: ReferralRewardStatus.REVERSED,
      walletLedgerReference: 'provider-reversal-ledger-withheld-1',
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-reversal:reward-withheld-reversal-1' },
        create: expect.objectContaining({
          amount: -90_000,
          metadata: expect.objectContaining({
            netReversalAmount: 90_000,
            pitWithheldAmount: 10_000,
            totalWithheldAmount: 10_000,
          }),
        }),
        update: {},
      }),
    );
    const journalUpsert = tx.accountingJournalBatch.upsert.mock.calls[0]?.[0];
    expect(journalUpsert).toEqual(
      expect.objectContaining({
        create: expect.objectContaining({
          totalCredit: 100_000,
          totalDebit: 100_000,
        }),
      }),
    );
    expect(journalUpsert.create.entries.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_wallet_liability',
          amount: 90_000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'referral_pit_withholding_payable',
          amount: 10_000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'partner_referral_reward_expense',
          amount: 100_000,
          side: 'CREDIT',
        }),
      ]),
    );
  });

  it('reverses held or available reward candidates without wallet ledger writes', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: ReferralRewardStatus.HELD,
          updatedAt: referralRewardUpdatedAt,
          walletLedgerReference: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 25000,
          availableAt: now,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:attr-1:booking-1',
          status: ReferralRewardStatus.REVERSED,
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.reverseRewardCandidate('reward-1', expectedRewardState(ReferralRewardStatus.HELD)),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.REVERSED,
    });
    expect(prisma.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: ReferralRewardStatus.REVERSED },
      where: { id: 'reward-1', status: ReferralRewardStatus.HELD, updatedAt: referralRewardUpdatedAt },
    });
  });

  it('moves an owned credited customer referral reward into cashout request once', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const creditedReward = {
      id: 'reward-request-1',
      amount: 25_000,
      availableAt: now,
      calculationSnapshot: {},
      currency: 'VND',
      qualifyingBookingId: 'booking-request-1',
      sourceKey: 'referral:CUSTOMER:attribution-request-1:booking-request-1',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'customer-earned-ledger-request-1',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    };
    const requestedReward = {
      id: creditedReward.id,
      amount: creditedReward.amount,
      availableAt: now,
      currency: creditedReward.currency,
      sourceKey: creditedReward.sourceKey,
      status: cashoutRequestedReferralRewardStatus,
      walletLedgerReference: creditedReward.walletLedgerReference,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 25_000 } }),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn(),
      },
      referralReward: {
        findFirst: vi.fn().mockResolvedValue(creditedReward),
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue(requestedReward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.requestCustomerRewardCashout('customer-user-1', creditedReward.id),
    ).resolves.toMatchObject({
      id: creditedReward.id,
      status: cashoutRequestedReferralRewardStatus,
    });
    expect(tx.customerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { customerProfileId: 'customer-profile-1', currency: 'VND' },
      _sum: { amount: true },
    });
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.customerWalletLedgerEntry.aggregate.mock.invocationCallOrder[0],
    );
    expect(tx.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: cashoutRequestedReferralRewardStatus },
      where: {
        id: creditedReward.id,
        status: creditedReferralRewardStatus,
        walletLedgerReference: creditedReward.walletLedgerReference,
        walletOwnerCustomerProfileId: 'customer-profile-1',
      },
    });
  });

  it('keeps a repeated owned referral cashout request idempotent', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const requestedCandidate = {
      id: 'reward-request-replay-1',
      amount: 25_000,
      calculationSnapshot: {},
      currency: 'VND',
      qualifyingBookingId: 'booking-request-replay-1',
      sourceKey: 'referral:CUSTOMER:attribution-request-replay-1:booking-request-replay-1',
      status: cashoutRequestedReferralRewardStatus,
      walletLedgerReference: 'customer-earned-ledger-request-replay-1',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    };
    const requestedReward = {
      id: requestedCandidate.id,
      amount: requestedCandidate.amount,
      availableAt: now,
      currency: requestedCandidate.currency,
      sourceKey: requestedCandidate.sourceKey,
      status: cashoutRequestedReferralRewardStatus,
      walletLedgerReference: requestedCandidate.walletLedgerReference,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: { aggregate: vi.fn() },
      providerWalletLedgerEntry: { aggregate: vi.fn() },
      referralReward: {
        findFirst: vi.fn().mockResolvedValue(requestedCandidate),
        findUniqueOrThrow: vi.fn().mockResolvedValue(requestedReward),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.requestCustomerRewardCashout('customer-user-1', requestedCandidate.id),
    ).resolves.toMatchObject({
      id: requestedCandidate.id,
      status: cashoutRequestedReferralRewardStatus,
    });
    expect(tx.customerWalletLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(tx.referralReward.updateMany).not.toHaveBeenCalled();
  });

  it('does not expose another customer referral reward through the cashout action', async () => {
    const tx = {
      referralReward: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.requestCustomerRewardCashout('customer-user-1', 'another-customer-reward'),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.referralReward.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'another-customer-reward',
          walletOwnerCustomerProfileId: 'customer-profile-1',
        },
      }),
    );
  });

  it('rejects Partner referral cashout when the current wallet ledger cannot cover it', async () => {
    const reward = {
      id: 'partner-reward-request-1',
      amount: 50_000,
      calculationSnapshot: {},
      currency: 'VND',
      qualifyingBookingId: 'booking-partner-request-1',
      sourceKey: 'referral:PARTNER:attribution-partner-request-1:booking-partner-request-1',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'provider-earned-ledger-request-1',
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: { aggregate: vi.fn() },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 10_000 } }),
      },
      referralReward: {
        findFirst: vi.fn().mockResolvedValue(reward),
        findMany: vi.fn().mockResolvedValue([]),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(service.requestPartnerRewardCashout('provider-user-1', reward.id)).rejects.toThrow(
      'Wallet balance cannot cover referral cashout',
    );
    expect(tx.providerWalletLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'provider-profile-1', currency: 'VND' },
      _sum: { amount: true },
    });
    expect(tx.referralReward.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a referral cashout when earlier requests already reserve the remaining wallet balance', async () => {
    const reward = {
      id: 'customer-reward-request-2',
      amount: 50_000,
      availableAt: new Date('2026-06-24T10:00:00.000Z'),
      calculationSnapshot: {},
      currency: 'VND',
      qualifyingBookingId: 'booking-customer-request-2',
      sourceKey: 'referral:CUSTOMER:attribution-request-2:booking-customer-request-2',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'customer-earned-ledger-request-2',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    };
    const reservedReward = {
      ...reward,
      id: 'customer-reward-reserved-1',
      amount: 70_000,
      status: cashoutRequestedReferralRewardStatus,
    };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 100_000 } }),
      },
      providerWalletLedgerEntry: { aggregate: vi.fn() },
      referralReward: {
        findFirst: vi.fn().mockResolvedValue(reward),
        findMany: vi.fn().mockResolvedValue([reservedReward]),
        updateMany: vi.fn(),
      },
    };
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.requestCustomerRewardCashout('customer-user-1', reward.id),
    ).rejects.toThrow('Wallet balance cannot cover referral cashout');

    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.referralReward.findMany.mock.invocationCallOrder[0],
    );
    expect(tx.referralReward.findMany).toHaveBeenCalledWith({
      where: {
        id: { not: reward.id },
        currency: 'VND',
        status: {
          in: [
            cashoutRequestedReferralRewardStatus,
            cashoutApprovedReferralRewardStatus,
            taxReviewRequiredReferralRewardStatus,
          ],
        },
        walletOwnerCustomerProfileId: 'customer-profile-1',
      },
      select: expect.any(Object),
    });
    expect(tx.referralReward.updateMany).not.toHaveBeenCalled();
  });

  it('approves customer referral cashout requests without posting payout cash automatically', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: cashoutRequestedReferralRewardStatus,
          updatedAt: referralRewardUpdatedAt,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 25000,
          availableAt: now,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:attr-1:booking-1',
          status: cashoutApprovedReferralRewardStatus,
          updatedAt: referralRewardUpdatedAt,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.approveRewardCashoutRequest(
        'reward-1',
        expectedRewardState(cashoutRequestedReferralRewardStatus),
      ),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: cashoutApprovedReferralRewardStatus,
      updatedAt: referralRewardUpdatedAt,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    expect(prisma.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: cashoutApprovedReferralRewardStatus },
      where: { id: 'reward-1', status: cashoutRequestedReferralRewardStatus, updatedAt: referralRewardUpdatedAt },
    });
  });

  it('marks referral rewards for tax review without changing wallet ledger references', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: cashoutRequestedReferralRewardStatus,
          updatedAt: referralRewardUpdatedAt,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 25000,
          availableAt: now,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:attr-1:booking-1',
          status: taxReviewRequiredReferralRewardStatus,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
      },
    };
    const service = createService(prisma);

    await expect(
      service.requireRewardTaxReview(
        'reward-1',
        expectedRewardState(cashoutRequestedReferralRewardStatus),
      ),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: taxReviewRequiredReferralRewardStatus,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    expect(prisma.referralReward.updateMany).toHaveBeenCalledWith({
      data: { status: taxReviewRequiredReferralRewardStatus },
      where: { id: 'reward-1', status: cashoutRequestedReferralRewardStatus, updatedAt: referralRewardUpdatedAt },
    });
  });

  it('credits an available customer referral reward to the customer wallet ledger once', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = creditableReward({
      id: 'reward-1',
      amount: 25_000,
      availableAt: now,
      currency: 'VND',
      qualifyingBookingId: 'booking-1',
      sourceKey: 'referral:CUSTOMER:attribution-1:booking-1',
      status: ReferralRewardStatus.AVAILABLE,
      walletLedgerReference: null,
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    });
    const ledger = { id: 'customer-wallet-ledger-1' };
    const tx = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ userId: 'customer-user-1' }),
      },
      customerWalletLedgerEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      providerWalletLedgerEntry: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          status: creditedReferralRewardStatus,
          walletLedgerReference: ledger.id,
        }),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'customer-referral-notification-1' }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const notifications = { enqueuePersistedNotification: vi.fn().mockResolvedValue(true) };
    const service = createService(prisma, notifications);

    await expect(
      service.creditRewardCandidate('reward-1', expectedRewardState(ReferralRewardStatus.AVAILABLE)),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    expect(tx.customerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-credit:reward-1' },
        update: {},
        create: expect.objectContaining({
          amount: 25_000,
          bookingId: 'booking-1',
          currency: 'VND',
          customerProfileId: 'customer-profile-1',
          referralRewardId: 'reward-1',
          reference: 'referral:CUSTOMER:attribution-1:booking-1',
          sourceKey: 'referral:wallet-credit:reward-1',
          type: 'CUSTOMER_REFERRAL_EARNED',
        }),
        select: { id: true },
      }),
    );
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'customer-user-1',
        type: 'customer.referral.reward_credited',
        title: 'Referral reward added',
        body: '25,000 VND referral reward was added to your HANDS wallet.',
        data: expect.objectContaining({
          amount: 25_000,
          bookingId: 'booking-1',
          referralRewardId: 'reward-1',
          targetRole: 'CUSTOMER',
        }),
      }),
      select: { id: true },
    });
    expect(notifications.enqueuePersistedNotification).toHaveBeenCalledWith(
      'customer-referral-notification-1',
    );
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: creditedReferralRewardStatus,
        walletLedgerReference: 'customer-wallet-ledger-1',
      },
      where: { id: 'reward-1', status: ReferralRewardStatus.LOCKED },
      select: expect.any(Object),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:referral-wallet-credit:reward-1' },
      update: {},
      create: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceKey: 'accounting-journal:referral-wallet-credit:reward-1',
        sourceId: 'reward-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
    });
    expect(tx.accountingJournalBatch.upsert.mock.calls[0]?.[0].update).toEqual({});
  });

  it('rejects wallet credit when an authoritative referral ledger already exists', async () => {
    const reward = creditableReward({
      id: 'reward-duplicate-ledger-1',
      amount: 25_000,
      currency: 'VND',
      qualifyingBookingId: 'booking-duplicate-ledger-1',
      sourceKey: 'referral:CUSTOMER:attribution-duplicate:booking-duplicate-ledger-1',
      status: ReferralRewardStatus.AVAILABLE,
      walletLedgerReference: null,
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    });
    const tx = {
      customerWalletLedgerEntry: {
        findUnique: vi.fn().mockResolvedValue({ id: 'existing-referral-ledger-1' }),
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: { findUnique: vi.fn(), upsert: vi.fn() },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn(),
      },
    };
    const service = createService({
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) => callback(tx)),
    });

    await expect(
      service.creditRewardCandidate(
        'reward-duplicate-ledger-1',
        expectedRewardState(ReferralRewardStatus.AVAILABLE),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.referralReward.updateMany).not.toHaveBeenCalled();
    expect(tx.customerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
  });

  it('credits an available Partner referral reward to the Partner wallet ledger once', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = creditableReward({
      id: 'reward-2',
      amount: 50_000,
      availableAt: now,
      currency: 'VND',
      qualifyingBookingId: 'booking-2',
      sourceKey: 'referral:PARTNER:attribution-2:booking-2',
      status: ReferralRewardStatus.AVAILABLE,
      walletLedgerReference: null,
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    });
    const ledger = { id: 'provider-wallet-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'partner-referral-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          status: creditedReferralRewardStatus,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.creditRewardCandidate('reward-2', expectedRewardState(ReferralRewardStatus.AVAILABLE)),
    ).resolves.toMatchObject({
      id: 'reward-2',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'provider-wallet-ledger-1',
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-credit:reward-2' },
        update: {},
        create: expect.objectContaining({
          amount: 50_000,
          bookingId: 'booking-2',
          currency: 'VND',
          providerProfileId: 'provider-profile-1',
          reference: 'referral:PARTNER:attribution-2:booking-2',
          sourceKey: 'referral:wallet-credit:reward-2',
          type: 'PARTNER_REFERRAL_EARNED',
        }),
        select: { id: true },
      }),
    );
    expect(tx.customerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: creditedReferralRewardStatus,
        walletLedgerReference: 'provider-wallet-ledger-1',
      },
      where: { id: 'reward-2', status: ReferralRewardStatus.LOCKED },
      select: expect.any(Object),
    });
  });

  it('credits Partner referral rewards net of withholding and records withholding payable', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = creditableReward({
      id: 'reward-withholding-1',
      amount: 100_000,
      availableAt: now,
      calculationSnapshot: { taxPolicySnapshot: 'INDIVIDUAL_COMMISSION_PIT_10' },
      currency: 'VND',
      qualifyingBookingId: 'booking-withholding-1',
      sourceKey: 'referral:PARTNER:attribution-withholding:booking-withholding-1',
      status: ReferralRewardStatus.AVAILABLE,
      walletLedgerReference: null,
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    });
    const ledger = { id: 'provider-wallet-ledger-withholding-1' };
    const tx = {
      customerWalletLedgerEntry: {
        findUnique: vi.fn(),
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'partner-referral-withholding-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          status: creditedReferralRewardStatus,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.creditRewardCandidate(
        'reward-withholding-1',
        expectedRewardState(ReferralRewardStatus.AVAILABLE),
      ),
    ).resolves.toMatchObject({
      id: 'reward-withholding-1',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'provider-wallet-ledger-withholding-1',
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-credit:reward-withholding-1' },
        create: expect.objectContaining({
          amount: 90_000,
          metadata: expect.objectContaining({
            netWalletAmount: 90_000,
            pitWithheldAmount: 10_000,
            totalWithheldAmount: 10_000,
          }),
        }),
        select: { id: true },
      }),
    );
    const journalUpsert = tx.accountingJournalBatch.upsert.mock.calls[0]?.[0];
    expect(journalUpsert).toEqual(
      expect.objectContaining({
        create: expect.objectContaining({
          totalCredit: 100_000,
          totalDebit: 100_000,
        }),
      }),
    );
    expect(journalUpsert.create.entries.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_referral_reward_expense',
          amount: 100_000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'partner_wallet_liability',
          amount: 90_000,
          side: 'CREDIT',
        }),
        expect.objectContaining({
          accountCode: 'referral_pit_withholding_payable',
          amount: 10_000,
          side: 'CREDIT',
        }),
      ]),
    );
  });

  it('marks an approved customer referral cashout as paid with a customer cashout ledger entry', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
      id: 'reward-1',
      amount: 25_000,
      availableAt: now,
      currency: 'VND',
      qualifyingBookingId: 'booking-1',
      sourceKey: 'referral:CUSTOMER:attribution-1:booking-1',
      status: cashoutApprovedReferralRewardStatus,
      updatedAt: referralRewardUpdatedAt,
      walletLedgerReference: 'customer-earned-ledger-1',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    };
    const ledger = { id: 'customer-cashout-ledger-1' };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 25_000 } }),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-cashout-journal-1' }),
      },
      referralReward: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          status: paidReferralRewardStatus,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.payRewardCashout('reward-1', {
        expectedStatus: cashoutApprovedReferralRewardStatus,
        expectedUpdatedAt: referralRewardUpdatedAt.toISOString(),
        notes: 'Manual bank transfer completed.',
        reference: 'VCB-REF-001',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: paidReferralRewardStatus,
      walletLedgerReference: 'customer-cashout-ledger-1',
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.customerWalletLedgerEntry.aggregate.mock.invocationCallOrder[0],
    );
    expect(tx.customerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-cashout:reward-1' },
        update: {},
        create: expect.objectContaining({
          amount: -25_000,
          bookingId: 'booking-1',
          currency: 'VND',
          customerProfileId: 'customer-profile-1',
          notes: 'Manual bank transfer completed.',
          referralRewardId: 'reward-1',
          reference: 'VCB-REF-001',
          sourceKey: 'referral:wallet-cashout:reward-1',
          type: 'CUSTOMER_REFERRAL_CASHOUT',
        }),
      }),
    );
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: paidReferralRewardStatus,
        walletLedgerReference: 'customer-cashout-ledger-1',
      },
      where: { id: 'reward-1', status: ReferralRewardStatus.LOCKED },
      select: expect.any(Object),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:referral-wallet-cashout:reward-1' },
      update: {},
      create: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceKey: 'accounting-journal:referral-wallet-cashout:reward-1',
        sourceId: 'reward-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
    });
  });

  it('marks an approved Partner referral cashout as paid with a Partner cashout ledger entry', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
      id: 'reward-2',
      amount: 50_000,
      availableAt: now,
      currency: 'VND',
      qualifyingBookingId: 'booking-2',
      sourceKey: 'referral:PARTNER:attribution-2:booking-2',
      status: cashoutApprovedReferralRewardStatus,
      updatedAt: referralRewardUpdatedAt,
      walletLedgerReference: 'provider-earned-ledger-1',
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    };
    const ledger = { id: 'provider-cashout-ledger-1' };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 50_000 } }),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'partner-referral-cashout-journal-1' }),
      },
      referralReward: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          status: paidReferralRewardStatus,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.payRewardCashout('reward-2', {
        expectedStatus: cashoutApprovedReferralRewardStatus,
        expectedUpdatedAt: referralRewardUpdatedAt.toISOString(),
        notes: 'Partner referral cashout paid.',
        reference: 'BIDV-REF-002',
      }),
    ).resolves.toMatchObject({
      id: 'reward-2',
      status: paidReferralRewardStatus,
      walletLedgerReference: 'provider-cashout-ledger-1',
    });
    expect(tx.$queryRaw).toHaveBeenCalledOnce();
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.providerWalletLedgerEntry.aggregate.mock.invocationCallOrder[0],
    );
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-cashout:reward-2' },
        update: {},
        create: expect.objectContaining({
          amount: -50_000,
          bookingId: 'booking-2',
          currency: 'VND',
          notes: 'Partner referral cashout paid.',
          providerProfileId: 'provider-profile-1',
          reference: 'BIDV-REF-002',
          sourceKey: 'referral:wallet-cashout:reward-2',
          type: 'PARTNER_REFERRAL_CASHOUT',
        }),
      }),
    );
    expect(tx.customerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: paidReferralRewardStatus,
        walletLedgerReference: 'provider-cashout-ledger-1',
      },
      where: { id: 'reward-2', status: ReferralRewardStatus.LOCKED },
      select: expect.any(Object),
    });
  });

  it('pays withheld Partner referral cashouts using the net wallet amount only', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
      id: 'reward-withheld-cashout-1',
      amount: 100_000,
      availableAt: now,
      calculationSnapshot: { taxPolicySnapshot: 'INDIVIDUAL_COMMISSION_PIT_10' },
      currency: 'VND',
      qualifyingBookingId: 'booking-withheld-cashout-1',
      sourceKey: 'referral:PARTNER:attribution-withheld-cashout:booking-withheld-cashout-1',
      status: cashoutApprovedReferralRewardStatus,
      updatedAt: referralRewardUpdatedAt,
      walletLedgerReference: 'provider-earned-ledger-withheld-cashout-1',
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    };
    const ledger = { id: 'provider-cashout-ledger-withheld-1' };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      customerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 90_000 } }),
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'partner-referral-withheld-cashout-journal-1' }),
      },
      referralReward: {
        findMany: vi.fn().mockResolvedValue([]),
        findUnique: vi.fn().mockResolvedValue(reward),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({
          ...reward,
          status: paidReferralRewardStatus,
          walletLedgerReference: ledger.id,
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    const service = createService(prisma);

    await expect(
      service.payRewardCashout('reward-withheld-cashout-1', {
        expectedStatus: cashoutApprovedReferralRewardStatus,
        expectedUpdatedAt: referralRewardUpdatedAt.toISOString(),
        notes: 'Partner referral cashout paid net of PIT.',
        reference: 'BIDV-REF-WHT-001',
      }),
    ).resolves.toMatchObject({
      id: 'reward-withheld-cashout-1',
      status: paidReferralRewardStatus,
      walletLedgerReference: 'provider-cashout-ledger-withheld-1',
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-cashout:reward-withheld-cashout-1' },
        update: {},
        create: expect.objectContaining({
          amount: -90_000,
          metadata: expect.objectContaining({
            netCashoutAmount: 90_000,
            pitWithheldAmount: 10_000,
            totalWithheldAmount: 10_000,
          }),
        }),
      }),
    );
    const journalUpsert = tx.accountingJournalBatch.upsert.mock.calls[0]?.[0];
    expect(journalUpsert).toEqual(
      expect.objectContaining({
        create: expect.objectContaining({
          totalCredit: 90_000,
          totalDebit: 90_000,
        }),
      }),
    );
    expect(journalUpsert.create.entries.create).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountCode: 'partner_wallet_liability',
          amount: 90_000,
          side: 'DEBIT',
        }),
        expect.objectContaining({
          accountCode: 'referral_cashout_bank_clearing',
          amount: 90_000,
          side: 'CREDIT',
        }),
      ]),
    );
  });

  it('creates a pending Partner referral reward only on the referred Partner first completed booking', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.COMPLETED,
          customerProfileId: 'customer-1',
          selectedProviderId: 'referred-partner-1',
          updatedAt: createdAt,
          earning: {
            id: 'earning-1',
            grossAmount: 1_000_000,
            platformFee: 200_000,
            currency: 'VND',
          },
        }),
      },
      providerEarning: {
        count: vi.fn().mockResolvedValue(0),
      },
      referralAttribution: {
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          id: 'partner-attribution-1',
          audience: ReferralAudience.PARTNER,
          referrerProviderProfileId: 'referrer-partner-1',
          referredProviderProfileId: 'referred-partner-1',
        }),
      },
      referralPolicy: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
          audience: ReferralAudience.PARTNER,
          enabled: true,
          rewardMode: ReferralRewardMode.FIXED_AMOUNT,
          commissionPercentBps: null,
          fixedRewardAmount: 100_000,
          perRewardCapAmount: 80_000,
          maxRewardedReferrals: 10,
          holdPeriodDays: 7,
          currency: 'VND',
        }),
      },
      referralReward: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 80_000,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:PARTNER:partner-attribution-1:booking-1',
        }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-1')).resolves.toMatchObject({
      customerReward: null,
      partnerReward: {
        amount: 80_000,
        sourceKey: 'referral:PARTNER:partner-attribution-1:booking-1',
      },
    });
    expect(prisma.referralReward.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: 80_000,
          attributionId: 'partner-attribution-1',
          qualifyingBookingId: 'booking-1',
          sourceKey: 'referral:PARTNER:partner-attribution-1:booking-1',
          walletOwnerProviderProfileId: 'referrer-partner-1',
        }),
      }),
    );
  });

  it('rejects referral reward creation for non-completed bookings', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.MATCHED,
          customerProfileId: 'customer-1',
          selectedProviderId: 'provider-1',
          updatedAt: new Date('2026-06-24T10:00:00.000Z'),
          earning: null,
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects referral code lookup when the role profile is missing', async () => {
    const prisma = {
      customerProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getCustomerReferralCode('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

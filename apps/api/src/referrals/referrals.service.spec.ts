import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  BookingStatus,
  CustomerWalletLedgerType,
  ProviderWalletLedgerType,
  ReferralAudience,
  ReferralRewardMode,
  ReferralRewardStatus,
} from '@prisma/client';
import { ReferralsService } from './referrals.service';

function createService(prisma: unknown) {
  return new ReferralsService(prisma as never);
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
        pendingAmount: 25_000,
        referralCount: 2,
        rewardedAmount: 85_000,
        reversedAmount: 0,
        rewardCount: 4,
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
          walletLedgerReference: null,
        }),
        update: vi.fn().mockResolvedValue({
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

    await expect(service.holdRewardCandidate('reward-1')).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.HELD,
    });
    expect(prisma.referralReward.update).toHaveBeenCalledWith({
      data: { status: ReferralRewardStatus.HELD },
      where: { id: 'reward-1' },
      select: expect.any(Object),
    });
  });

  it('rejects reward candidate state changes after wallet credit exists', async () => {
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: ReferralRewardStatus.AVAILABLE,
          walletLedgerReference: 'wallet-ledger-1',
        }),
        update: vi.fn(),
      },
    };
    const service = createService(prisma);

    await expect(service.reverseRewardCandidate('reward-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.referralReward.update).not.toHaveBeenCalled();
  });

  it('reverses credited referral rewards with wallet and journal reversal entries', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
      id: 'reward-credited-1',
      amount: 25_000,
      calculationSnapshot: { taxPolicySnapshot: 'CUSTOMER_SERVICE_CREDIT_ONLY' },
      currency: 'VND',
      qualifyingBookingId: 'booking-1',
      sourceKey: 'referral:CUSTOMER:attribution-1:booking-1',
      status: creditedReferralRewardStatus,
      walletLedgerReference: 'customer-earned-ledger-1',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    };
    const ledger = { id: 'customer-reversal-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-reversal-journal-1' }),
      },
      referralReward: {
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

    await expect(service.reverseRewardCandidate('reward-credited-1')).resolves.toMatchObject({
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
        select: { id: true },
      }),
    );
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:referral-wallet-reversal:reward-credited-1' },
      update: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceId: 'reward-credited-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
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
      where: { id: 'reward-credited-1' },
      select: expect.any(Object),
    });
  });

  it('reverses held or available reward candidates without wallet ledger writes', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: ReferralRewardStatus.HELD,
          walletLedgerReference: null,
        }),
        update: vi.fn().mockResolvedValue({
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

    await expect(service.reverseRewardCandidate('reward-1')).resolves.toMatchObject({
      id: 'reward-1',
      status: ReferralRewardStatus.REVERSED,
    });
    expect(prisma.referralReward.update).toHaveBeenCalledWith({
      data: { status: ReferralRewardStatus.REVERSED },
      where: { id: 'reward-1' },
      select: expect.any(Object),
    });
  });

  it('approves customer referral cashout requests without posting payout cash automatically', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: cashoutRequestedReferralRewardStatus,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
        update: vi.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 25000,
          availableAt: now,
          currency: 'VND',
          sourceKey: 'referral:CUSTOMER:attr-1:booking-1',
          status: cashoutApprovedReferralRewardStatus,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
      },
    };
    const service = createService(prisma);

    await expect(service.approveRewardCashoutRequest('reward-1')).resolves.toMatchObject({
      id: 'reward-1',
      status: cashoutApprovedReferralRewardStatus,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    expect(prisma.referralReward.update).toHaveBeenCalledWith({
      data: { status: cashoutApprovedReferralRewardStatus },
      where: { id: 'reward-1' },
      select: expect.any(Object),
    });
  });

  it('marks referral rewards for tax review without changing wallet ledger references', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      referralReward: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'reward-1',
          status: cashoutRequestedReferralRewardStatus,
          walletLedgerReference: 'customer-wallet-ledger-1',
        }),
        update: vi.fn().mockResolvedValue({
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

    await expect(service.requireRewardTaxReview('reward-1')).resolves.toMatchObject({
      id: 'reward-1',
      status: taxReviewRequiredReferralRewardStatus,
      walletLedgerReference: 'customer-wallet-ledger-1',
    });
    expect(prisma.referralReward.update).toHaveBeenCalledWith({
      data: { status: taxReviewRequiredReferralRewardStatus },
      where: { id: 'reward-1' },
      select: expect.any(Object),
    });
  });

  it('credits an available customer referral reward to the customer wallet ledger once', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
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
    };
    const ledger = { id: 'customer-wallet-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
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

    await expect(service.creditRewardCandidate('reward-1')).resolves.toMatchObject({
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
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: creditedReferralRewardStatus,
        walletLedgerReference: 'customer-wallet-ledger-1',
      },
      where: { id: 'reward-1' },
      select: expect.any(Object),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:referral-wallet-credit:reward-1' },
      update: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceId: 'reward-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
      create: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceKey: 'accounting-journal:referral-wallet-credit:reward-1',
        sourceId: 'reward-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
    });
  });

  it('credits an available Partner referral reward to the Partner wallet ledger once', async () => {
    const now = new Date('2026-06-24T10:00:00.000Z');
    const reward = {
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
    };
    const ledger = { id: 'provider-wallet-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'partner-referral-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
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

    await expect(service.creditRewardCandidate('reward-2')).resolves.toMatchObject({
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
      where: { id: 'reward-2' },
      select: expect.any(Object),
    });
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
      walletLedgerReference: 'customer-earned-ledger-1',
      walletOwnerCustomerProfileId: 'customer-profile-1',
      walletOwnerProviderProfileId: null,
    };
    const ledger = { id: 'customer-cashout-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'referral-cashout-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
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
        notes: 'Manual bank transfer completed.',
        reference: 'VCB-REF-001',
      }),
    ).resolves.toMatchObject({
      id: 'reward-1',
      status: paidReferralRewardStatus,
      walletLedgerReference: 'customer-cashout-ledger-1',
    });
    expect(tx.customerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-cashout:reward-1' },
        update: expect.objectContaining({
          amount: -25_000,
          reference: 'VCB-REF-001',
        }),
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
        select: { id: true },
      }),
    );
    expect(tx.providerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: paidReferralRewardStatus,
        walletLedgerReference: 'customer-cashout-ledger-1',
      },
      where: { id: 'reward-1' },
      select: expect.any(Object),
    });
    expect(tx.accountingJournalBatch.upsert).toHaveBeenCalledWith({
      where: { sourceKey: 'accounting-journal:referral-wallet-cashout:reward-1' },
      update: expect.objectContaining({
        customerProfileId: 'customer-profile-1',
        sourceId: 'reward-1',
        sourceType: 'REFERRAL_REWARD',
        totalCredit: 25_000,
        totalDebit: 25_000,
      }),
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
      walletLedgerReference: 'provider-earned-ledger-1',
      walletOwnerCustomerProfileId: null,
      walletOwnerProviderProfileId: 'provider-profile-1',
    };
    const ledger = { id: 'provider-cashout-ledger-1' };
    const tx = {
      customerWalletLedgerEntry: {
        upsert: vi.fn(),
      },
      providerWalletLedgerEntry: {
        upsert: vi.fn().mockResolvedValue(ledger),
      },
      accountingJournalBatch: {
        upsert: vi.fn().mockResolvedValue({ id: 'partner-referral-cashout-journal-1' }),
      },
      referralReward: {
        findUnique: vi.fn().mockResolvedValue(reward),
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
        notes: 'Partner referral cashout paid.',
        reference: 'BIDV-REF-002',
      }),
    ).resolves.toMatchObject({
      id: 'reward-2',
      status: paidReferralRewardStatus,
      walletLedgerReference: 'provider-cashout-ledger-1',
    });
    expect(tx.providerWalletLedgerEntry.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { sourceKey: 'referral:wallet-cashout:reward-2' },
        update: expect.objectContaining({
          amount: -50_000,
          reference: 'BIDV-REF-002',
        }),
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
        select: { id: true },
      }),
    );
    expect(tx.customerWalletLedgerEntry.upsert).not.toHaveBeenCalled();
    expect(tx.referralReward.update).toHaveBeenCalledWith({
      data: {
        status: paidReferralRewardStatus,
        walletLedgerReference: 'provider-cashout-ledger-1',
      },
      where: { id: 'reward-2' },
      select: expect.any(Object),
    });
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
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
            id: 'partner-attribution-1',
            audience: ReferralAudience.PARTNER,
            referrerProviderProfileId: 'referrer-partner-1',
            referredProviderProfileId: 'referred-partner-1',
          }),
      },
      referralPolicy: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({
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

    await expect(service.createRewardsForCompletedBooking('booking-1')).rejects.toBeInstanceOf(BadRequestException);
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

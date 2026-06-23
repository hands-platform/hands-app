import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus, ReferralAudience, ReferralRewardMode, ReferralRewardStatus } from '@prisma/client';
import { ReferralsService } from './referrals.service';

function createService(prisma: unknown) {
  return new ReferralsService(prisma as never);
}

describe('ReferralsService', () => {
  it('returns an existing customer referral code without creating a new one', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getCustomerReferralCode('user-1')).resolves.toBeNull();
  });

  it('summarizes customer referral code and reward totals without listing every customer', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralAttribution: {
        count: jest.fn().mockResolvedValue(2),
      },
      referralCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HCUSTOMER',
          createdAt,
          updatedAt: createdAt,
        }),
      },
      referralReward: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'PENDING', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 25_000 } },
          { status: 'AVAILABLE', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 75_000 } },
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
        reversedAmount: 0,
        rewardCount: 2,
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
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralCode: {
        create: jest.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.CUSTOMER,
          code: 'HC2D1B20B37',
          createdAt,
          updatedAt: createdAt,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
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
        findUnique: jest.fn().mockResolvedValue({ id: 'referred-customer-1' }),
      },
      referralAttribution: {
        create: jest.fn().mockResolvedValue({
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
        findFirst: jest.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: jest.fn().mockResolvedValue({
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

  it('returns the existing customer referral attribution without creating a duplicate', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUnique: jest.fn().mockResolvedValue({ id: 'referred-customer-1' }),
      },
      referralAttribution: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue({
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
        findFirst: jest.fn(),
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
        findUnique: jest.fn().mockResolvedValue({ id: 'customer-profile-1' }),
      },
      referralAttribution: {
        create: jest.fn(),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      referralCode: {
        create: jest.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.PARTNER,
          code: 'HP2D1B20B37',
          createdAt,
          updatedAt: createdAt,
        }),
        findFirst: jest.fn().mockResolvedValue(null),
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
        findUnique: jest.fn().mockResolvedValue({ id: 'referred-partner-1' }),
      },
      referralAttribution: {
        create: jest.fn().mockResolvedValue({
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
        findFirst: jest.fn().mockResolvedValue(null),
      },
      referralCode: {
        findFirst: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({ id: 'provider-profile-1' }),
      },
      referralAttribution: {
        count: jest.fn().mockResolvedValue(3),
      },
      referralCode: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'code-1',
          active: true,
          audience: ReferralAudience.PARTNER,
          code: 'HPARTNER',
          createdAt,
          updatedAt: createdAt,
        }),
      },
      referralReward: {
        groupBy: jest.fn().mockResolvedValue([
          { status: 'HELD', currency: 'VND', _count: { _all: 1 }, _sum: { amount: 100_000 } },
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
        reversedAmount: 0,
        rewardCount: 1,
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
        findUnique: jest.fn().mockResolvedValue({
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
        count: jest.fn().mockResolvedValue(1),
      },
      referralAttribution: {
        findFirst: jest
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
        findUnique: jest
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
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 15_000,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
          availableAt,
        }),
        findUnique: jest.fn().mockResolvedValue(null),
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
        findUnique: jest.fn().mockResolvedValue({
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
        findFirst: jest
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
        findUnique: jest
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
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 490_000 } }),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 10_000,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:CUSTOMER:customer-attribution-1:booking-1',
        }),
        findUnique: jest.fn().mockResolvedValue(null),
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

  it('skips customer referral reward when the referred account reward count is already capped', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
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
        findFirst: jest
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
        findUnique: jest
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
        count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(1),
        create: jest.fn(),
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.createRewardsForCompletedBooking('booking-2')).resolves.toEqual({
      customerReward: null,
      partnerReward: null,
    });
    expect(prisma.referralReward.create).not.toHaveBeenCalled();
  });

  it('creates a pending Partner referral reward only on the referred Partner first completed booking', async () => {
    const createdAt = new Date('2026-06-24T10:00:00.000Z');
    const prisma = {
      booking: {
        findUnique: jest.fn().mockResolvedValue({
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
        count: jest.fn().mockResolvedValue(0),
      },
      referralAttribution: {
        findFirst: jest
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
        findUnique: jest
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
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockResolvedValue({
          id: 'reward-1',
          amount: 80_000,
          currency: 'VND',
          status: ReferralRewardStatus.PENDING,
          sourceKey: 'referral:PARTNER:partner-attribution-1:booking-1',
        }),
        findUnique: jest.fn().mockResolvedValue(null),
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
        findUnique: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = createService(prisma);

    await expect(service.getCustomerReferralCode('user-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

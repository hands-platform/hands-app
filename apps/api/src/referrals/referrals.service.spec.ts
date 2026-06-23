import { NotFoundException } from '@nestjs/common';
import { ReferralAudience } from '@prisma/client';
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

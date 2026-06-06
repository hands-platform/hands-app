import {
  ProviderStatus,
  VerificationStatus,
  ProviderKycStatus,
  ProviderBankAccountStatus,
} from '@prisma/client';

import { ProvidersService } from './providers.service';

describe('ProvidersService nearby discovery', () => {
  it('falls back to the Vietnam browse pin when the customer browses from outside Vietnam', async () => {
    const service = new ProvidersService(
      {
        providerProfile: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'partner-hcm',
              displayName: 'Linh Wellness',
              status: ProviderStatus.ONLINE_AVAILABLE,
              currentLat: 10.7769,
              currentLng: 106.7009,
              currentLocationUpdatedAt: new Date(),
              ratingAvg: 5,
              reviewCount: 14,
              user: { fullName: 'Linh Wellness', phone: '0900000000', fileAssets: [] },
              services: [],
              reviews: [],
              verification: { status: VerificationStatus.APPROVED },
              kyc: { status: ProviderKycStatus.APPROVED },
              bankAccounts: [{ status: ProviderBankAccountStatus.APPROVED }],
              documents: [],
            },
          ]),
        },
      } as never,
      {} as never,
      {
        get: jest.fn(),
      } as never,
    );

    const partners = await service.findNearby(13.7563, 100.5018);

    expect(partners[0].distanceMeters).toBe(0);
  });

  it('does not expose partner phone numbers in public nearby discovery', async () => {
    const service = new ProvidersService(
      {
        providerProfile: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'partner-hcm',
              displayName: 'Linh Wellness',
              status: ProviderStatus.ONLINE_AVAILABLE,
              currentLat: 10.7769,
              currentLng: 106.7009,
              currentLocationUpdatedAt: new Date(),
              ratingAvg: 5,
              reviewCount: 14,
              user: { fullName: 'Linh Wellness', phone: '0900000000', fileAssets: [] },
              services: [],
              reviews: [],
              verification: { status: VerificationStatus.APPROVED },
              kyc: { status: ProviderKycStatus.APPROVED },
              bankAccounts: [{ status: ProviderBankAccountStatus.APPROVED }],
              documents: [],
            },
          ]),
        },
      } as never,
      {} as never,
      {
        get: jest.fn(),
      } as never,
    );

    const partners = await service.findNearby(10.7769, 106.7009);

    expect(JSON.stringify(partners[0])).not.toContain('0900000000');
    expect(Object.keys((partners[0].user ?? {}) as Record<string, unknown>)).not.toContain('phone');
  });
});

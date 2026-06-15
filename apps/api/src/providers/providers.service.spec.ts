import {
  ProviderStatus,
  VerificationStatus,
  ProviderKycStatus,
  ProviderBankAccountStatus,
} from '@prisma/client';

import { ProvidersService } from './providers.service';

describe('ProvidersService nearby discovery', () => {
  it('preserves global browse coordinates for long-distance partner metadata', async () => {
    const service = createServiceWithNearbyProviders([nearbyProviderFixture()]);

    const partners = await service.findNearby(37.5665, 126.978);

    expect(partners[0].distanceMeters).toBeGreaterThan(1_000_000);
  });

  it('uses the Vietnam browse fallback only when discovery coordinates are missing or invalid', async () => {
    const service = createServiceWithNearbyProviders([nearbyProviderFixture()]);

    const partners = await service.findNearby(Number.NaN, Number.NaN);

    expect(partners[0].distanceMeters).toBe(0);
  });

  it('does not expose partner phone numbers in public nearby discovery', async () => {
    const service = createServiceWithNearbyProviders([nearbyProviderFixture()]);

    const partners = await service.findNearby(10.7769, 106.7009);

    expect(JSON.stringify(partners[0])).not.toContain('0900000000');
    expect(Object.keys((partners[0].user ?? {}) as Record<string, unknown>)).not.toContain('phone');
  });

  it('skips partners with invalid saved coordinates in public nearby discovery', async () => {
    const service = createServiceWithNearbyProviders([
      nearbyProviderFixture({ id: 'partner-invalid', currentLat: 'not-a-coordinate' }),
      nearbyProviderFixture({ id: 'partner-valid' }),
    ]);

    const partners = await service.findNearby(10.7769, 106.7009);

    expect(partners).toHaveLength(1);
    expect(partners[0].id).toBe('partner-valid');
    expect(Number.isFinite(partners[0].distanceMeters)).toBe(true);
  });

  it('does not expose private review or media storage fields in public partner detail', async () => {
    const service = new ProvidersService(
      {
        providerProfile: {
          findFirstOrThrow: jest.fn().mockResolvedValue({
            id: 'partner-hcm',
            displayName: 'Linh Wellness',
            user: {
              fullName: 'Linh Wellness',
              phone: '0900000000',
              fileAssets: [
                {
                  id: 'file-1',
                  url: 'https://cdn.hands.vn/public/profile.jpg',
                  key: 'private/storage/key/profile.jpg',
                  purpose: 'PROFILE_IMAGE',
                  contentType: 'image/jpeg',
                },
              ],
            },
            services: [],
            reviews: [
              {
                id: 'review-1',
                bookingId: 'booking-1',
                customerProfileId: 'customer-1',
                providerProfileId: 'partner-hcm',
                rating: 5,
                comment: 'Great service.',
                status: 'PUBLISHED',
                reportReason: 'internal moderation note',
                moderatedAt: new Date(),
                createdAt: new Date('2026-06-01T00:00:00.000Z'),
              },
            ],
          }),
        },
      } as never,
      {} as never,
      {
        get: jest.fn(),
      } as never,
    );

    const detail = await service.getDetail('partner-hcm');
    const serialized = JSON.stringify(detail);

    expect(serialized).not.toContain('0900000000');
    expect(serialized).not.toContain('private/storage/key');
    expect(serialized).not.toContain('booking-1');
    expect(serialized).not.toContain('customer-1');
    expect(serialized).not.toContain('internal moderation note');
    expect(detail.reviews[0]).toEqual({
      rating: 5,
      comment: 'Great service.',
      createdAt: '2026-06-01T00:00:00.000Z',
    });
  });
});

function createServiceWithNearbyProviders(providers: unknown[]) {
  return new ProvidersService(
    {
      providerProfile: {
        findMany: jest.fn().mockResolvedValue(providers),
      },
    } as never,
    {} as never,
    {
      get: jest.fn(),
    } as never,
  );
}

function nearbyProviderFixture(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

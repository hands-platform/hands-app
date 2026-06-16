import {
  ProviderStatus,
  VerificationStatus,
  ProviderKycStatus,
  ProviderBankAccountStatus,
  ReviewStatus,
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

  it('requests only published review ratings in public nearby discovery', async () => {
    const prisma = {
      providerProfile: {
        findMany: jest.fn().mockResolvedValue([nearbyProviderFixture()]),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      {} as never,
      {
        get: jest.fn(),
      } as never,
    );

    await service.findNearby(10.7769, 106.7009);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          reviews: expect.objectContaining({
            where: { status: ReviewStatus.PUBLISHED },
          }),
        }),
      }),
    );
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
    const prisma = {
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
              status: ReviewStatus.PUBLISHED,
              reportReason: 'internal moderation note',
              moderatedAt: new Date(),
              createdAt: new Date('2026-06-01T00:00:00.000Z'),
            },
            {
              id: 'review-held',
              bookingId: 'booking-2',
              customerProfileId: 'customer-2',
              providerProfileId: 'partner-hcm',
              rating: 1,
              comment: 'Held review should not appear.',
              status: ReviewStatus.HIDDEN,
              reportReason: 'Held by admin',
              moderatedAt: new Date(),
              createdAt: new Date('2026-06-02T00:00:00.000Z'),
            },
          ],
        }),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      {} as never,
      {
        get: jest.fn(),
      } as never,
    );

    const detail = await service.getDetail('partner-hcm');
    const serialized = JSON.stringify(detail);

    expect(prisma.providerProfile.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          reviews: expect.objectContaining({
            where: { status: ReviewStatus.PUBLISHED },
          }),
        }),
      }),
    );

    expect(serialized).not.toContain('0900000000');
    expect(serialized).not.toContain('private/storage/key');
    expect(serialized).not.toContain('booking-1');
    expect(serialized).not.toContain('customer-1');
    expect(serialized).not.toContain('internal moderation note');
    expect(serialized).not.toContain('Held review should not appear.');
    expect(detail.reviews).toEqual([
      {
        rating: 5,
        comment: 'Great service.',
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]);
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

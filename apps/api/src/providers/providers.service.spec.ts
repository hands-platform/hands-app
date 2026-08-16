import {
  BookingStatus,
  FilePurpose,
  FileUploadStatus,
  FileVisibility,
  ProviderAvailabilityIntent,
  ProviderAvailabilityReason,
  ProviderStatus,
  VerificationStatus,
  ProviderKycStatus,
  ProviderBankAccountStatus,
  ReviewStatus,
} from '@prisma/client';

import { ProvidersService } from './providers.service';
import {
  MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
  MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
} from '../matching/matching.policy';
import { publicProviderIdentityWhere } from './provider-public-readiness';

describe('public Partner identity readiness', () => {
  it('does not require an approved payout bank account for marketplace visibility', () => {
    expect(publicProviderIdentityWhere()).not.toHaveProperty('bankAccounts');
  });
});

describe('ProvidersService verification file ownership', () => {
  it('attaches only uploaded private verification files owned by the authenticated Partner', async () => {
    const transaction = verificationTransactionFixture(['file-1', 'file-2']);
    const prisma = {
      $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(transaction)),
      providerProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'user-1' }) },
    };
    const service = new ProvidersService(prisma as never, {} as never, {} as never);

    await service.submitVerification('user-1', { fileIds: ['file-1', 'file-2'] });

    expect(transaction.fileAsset.findMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: ['file-1', 'file-2'] },
        ownerUserId: 'user-1',
        purpose: FilePurpose.PROVIDER_VERIFICATION,
        uploadStatus: FileUploadStatus.UPLOADED,
        visibility: FileVisibility.PRIVATE,
      }),
      select: { id: true },
    });
    expect(transaction.fileAsset.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { providerVerificationId: 'verification-1' } }),
    );
  });

  it('rejects the whole submission when any requested file is ineligible', async () => {
    const transaction = verificationTransactionFixture(['file-1']);
    const prisma = {
      $transaction: vi.fn((callback: (tx: unknown) => Promise<unknown>) => callback(transaction)),
      providerProfile: { findUnique: vi.fn().mockResolvedValue({ id: 'provider-1', userId: 'user-1' }) },
    };
    const service = new ProvidersService(prisma as never, {} as never, {} as never);

    await expect(
      service.submitVerification('user-1', { fileIds: ['file-1', 'foreign-file'] }),
    ).rejects.toThrow('Every verification file must be an uploaded private file owned by the authenticated partner');

    expect(transaction.fileAsset.updateMany).not.toHaveBeenCalled();
    expect(transaction.providerVerification.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe('ProvidersService nearby discovery', () => {
  it('preserves global browse coordinates for long-distance partner metadata', async () => {
    const service = createServiceWithNearbyProviders([nearbyProviderFixture()]);

    const partners = await service.findNearby(37.5665, 126.978);

    expect(partners[0]).toMatchObject({
      distanceBucket: 'OVER_20_KM',
      distanceBucketRank: 4,
      distanceLabel: '20+ km',
    });
  });

  it('returns completed booking count for customer ranking without exposing booking rows', async () => {
    const service = createServiceWithNearbyProviders([
      nearbyProviderFixture({ _count: { selectedBookings: 7 } }),
    ]);

    const [partner] = await service.findNearby(10.7769, 106.7009);

    expect(partner.completedBookingCount).toBe(7);
    expect(partner).not.toHaveProperty('selectedBookings');
  });

  it('uses the Vietnam browse fallback only when discovery coordinates are missing or invalid', async () => {
    const service = createServiceWithNearbyProviders([nearbyProviderFixture()]);

    const partners = await service.findNearby(Number.NaN, Number.NaN);

    expect(partners[0]).toMatchObject({
      distanceBucket: 'WITHIN_3_KM',
      distanceBucketRank: 0,
      distanceLabel: 'Within 3 km',
    });
  });

  it('does not expose partner phone numbers in public nearby discovery', async () => {
    const service = createServiceWithNearbyProviders([nearbyProviderFixture()]);

    const partners = await service.findNearby(10.7769, 106.7009);

    expect(JSON.stringify(partners[0])).not.toContain('0900000000');
    expect(Object.keys((partners[0].user ?? {}) as Record<string, unknown>)).not.toContain('phone');
  });

  it('returns a booking-safe service flag without exposing payout rules', async () => {
    const service = createServiceWithNearbyProviders([
      nearbyProviderFixture({
        services: [
          {
            id: 'partner-service-1',
            providerProfileId: 'partner-hcm',
            serviceId: 'service-1',
            price: 500000,
            active: true,
            service: {
              id: 'service-1',
              serviceGroupKey: 'relaxing',
              name: 'Relaxing massage',
              nameTranslations: {
                vi: 'Massage thư giãn',
                en: 'Relaxing massage',
              },
              description: 'A calming full-body massage.',
              durationMin: 60,
              basePrice: 400000,
              priceStep: 100000,
              displayOrder: 1,
              active: true,
              payoutRules: [{ customerPrice: 500000 }],
            },
          },
        ],
      }),
    ]);

    const [partner] = await service.findNearby(10.7769, 106.7009);
    const [partnerService] = partner.services;
    const serialized = JSON.stringify(partnerService);

    expect(partnerService).toMatchObject({
      id: 'partner-service-1',
      bookable: true,
      price: 500000,
      service: expect.objectContaining({
        nameTranslations: {
          vi: 'Massage thư giãn',
          en: 'Relaxing massage',
        },
      }),
    });
    expect(serialized).not.toContain('payoutRules');
    expect(serialized).not.toContain('customerPrice');
  });

  it('returns only a broad distance bucket and strips provider location coordinates and timestamps', async () => {
    const service = createServiceWithNearbyProviders([
      nearbyProviderFixture({
        currentLat: 10.7769123,
        currentLng: 106.7009456,
        legalName: 'Private legal name',
        residentialAddress: 'Private home address',
        blockedReason: 'Internal moderation reason',
        userId: 'private-user-id',
      }),
    ]);

    const [partner] = await service.findNearby(10.77, 106.69);
    const serialized = JSON.stringify(partner);

    expect(partner).toMatchObject({
      distanceBucket: 'WITHIN_3_KM',
      distanceBucketRank: 0,
      distanceLabel: 'Within 3 km',
      locationFreshness: expect.stringMatching(/^(FRESH|STALE|UNKNOWN)$/),
    });
    expect(partner).not.toHaveProperty('currentLat');
    expect(partner).not.toHaveProperty('currentLng');
    expect(partner).not.toHaveProperty('currentLocationUpdatedAt');
    expect(serialized).not.toContain('Private legal name');
    expect(serialized).not.toContain('Private home address');
    expect(serialized).not.toContain('Internal moderation reason');
    expect(serialized).not.toContain('private-user-id');
    expect(serialized).not.toContain('10.7769123');
    expect(serialized).not.toContain('106.7009456');
  });

  it('bounds public nearby discovery by default and does not select private contact fields', async () => {
    const prisma = {
      operationalPolicySetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([nearbyProviderFixture()]),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      {} as never,
      {
        get: vi.fn(),
      } as never,
    );

    await service.findNearby(10.7769, 106.7009);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 20,
        include: expect.objectContaining({
          user: expect.objectContaining({
            select: expect.not.objectContaining({
              phone: true,
              email: true,
            }),
          }),
        }),
      }),
    );
  });

  it('clamps public nearby discovery limit to the public maximum', async () => {
    const prisma = {
      operationalPolicySetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([nearbyProviderFixture()]),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      {} as never,
      {
        get: vi.fn(),
      } as never,
    );

    await service.findNearby(10.7769, 106.7009, { take: '999' });

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('prioritizes recently updated locations before applying the public discovery limit', async () => {
    const prisma = {
      operationalPolicySetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([nearbyProviderFixture()]),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      {} as never,
      {
        get: vi.fn(),
      } as never,
    );

    await service.findNearby(10.7769, 106.7009);

    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ currentLocationUpdatedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 20,
      }),
    );
  });

  it('requests only published review ratings in public nearby discovery', async () => {
    const prisma = {
      operationalPolicySetting: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      providerProfile: {
        findMany: vi.fn().mockResolvedValue([nearbyProviderFixture()]),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      {} as never,
      {
        get: vi.fn(),
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
    expect(Number.isInteger(partners[0].distanceBucketRank)).toBe(true);
  });

  it('uses the matching policy default instead of the retired 30-minute discovery setting', async () => {
    const now = new Date('2026-07-20T08:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const prisma = nearbyDiscoveryPrisma([
        nearbyProviderFixture({
          currentLocationUpdatedAt: new Date(now.getTime() - 60 * 60_000),
        }),
      ]);
      const service = new ProvidersService(
        prisma as never,
        {} as never,
        {
          get: vi.fn((key: string) => (key === 'PROVIDER_STALE_AFTER_MINUTES' ? '30' : undefined)),
        } as never,
      );

      const partners = await service.findNearby(10.7769, 106.7009);

      expect(partners[0].isRecentLocation).toBe(true);
      expect(prisma.operationalPolicySetting.findMany).toHaveBeenCalledWith({
        where: {
          key: {
            in: [
              MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY,
              MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY,
            ],
          },
        },
        select: { key: true, value: true },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps stale saved locations visible while using the canonical policy for the freshness flag', async () => {
    const now = new Date('2026-07-20T08:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const prisma = nearbyDiscoveryPrisma(
        [
          nearbyProviderFixture({
            currentLocationUpdatedAt: new Date(now.getTime() - 60 * 60_000),
          }),
        ],
        [
          { key: MATCHING_MARKETPLACE_PARTNER_LOCATION_MAX_AGE_MINUTES_KEY, value: 90 },
          { key: MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY, value: 30 },
        ],
      );
      const service = new ProvidersService(prisma as never, {} as never, { get: vi.fn() } as never);

      const partners = await service.findNearby(10.7769, 106.7009);

      expect(partners[0].isRecentLocation).toBe(true);
      expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            services: {
              some: {
                active: true,
                service: { active: true },
              },
            },
          }),
        }),
      );
      const [{ where }] = prisma.providerProfile.findMany.mock.calls[0];
      expect(where).not.toHaveProperty('currentLocationUpdatedAt');
      expect(where).not.toHaveProperty('status');
      expect(where).not.toHaveProperty('bankAccounts');
    } finally {
      vi.useRealTimers();
    }
  });

  it('falls back to the saved legacy matching location freshness policy', async () => {
    const now = new Date('2026-07-20T08:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const prisma = nearbyDiscoveryPrisma(
        [
          nearbyProviderFixture({
            currentLocationUpdatedAt: new Date(now.getTime() - 45 * 60_000),
          }),
        ],
        [{ key: MATCHING_BACKUP_PROVIDER_LOCATION_MAX_AGE_MINUTES_KEY, value: 30 }],
      );
      const service = new ProvidersService(prisma as never, {} as never, { get: vi.fn() } as never);

      const partners = await service.findNearby(10.7769, 106.7009);

      expect(partners[0].isRecentLocation).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not expose private review or media storage fields in public partner detail', async () => {
    const prisma = {
      providerProfile: {
        findFirstOrThrow: vi.fn().mockResolvedValue({
          id: 'partner-hcm',
          displayName: 'Linh Wellness',
          status: ProviderStatus.ONLINE_AVAILABLE,
          ratingAvg: 5,
          reviewCount: 14,
          currentLat: 10.7769123,
          currentLng: 106.7009456,
          legalName: 'Private legal name',
          residentialAddress: 'Private home address',
          blockedReason: 'Internal moderation reason',
          userId: 'private-user-id',
          user: {
            fullName: 'Linh Wellness',
            phone: '0900000000',
            email: 'linh@example.com',
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
              createdByAdminId: 'admin-1',
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
        get: vi.fn(),
      } as never,
    );

    const detail = await service.getDetail('partner-hcm');
    const serialized = JSON.stringify(detail);
    const detailQuery = prisma.providerProfile.findFirstOrThrow.mock.calls[0][0] as {
      include: Record<string, unknown>;
    };

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
    expect(serialized).not.toContain('linh@example.com');
    expect(serialized).not.toContain('private/storage/key');
    expect(serialized).not.toContain('booking-1');
    expect(serialized).not.toContain('customer-1');
    expect(serialized).not.toContain('internal moderation note');
    expect(serialized).not.toContain('admin-1');
    expect(serialized).not.toContain('Held review should not appear.');
    expect(serialized).not.toContain('Private legal name');
    expect(serialized).not.toContain('Private home address');
    expect(serialized).not.toContain('Internal moderation reason');
    expect(serialized).not.toContain('private-user-id');
    expect(serialized).not.toContain('10.7769123');
    expect(serialized).not.toContain('106.7009456');
    expect(detail).not.toHaveProperty('currentLat');
    expect(detail).not.toHaveProperty('currentLng');
    expect(detailQuery.include).not.toHaveProperty('bankAccounts');
    expect(detailQuery.include).not.toHaveProperty('documents');
    expect(detailQuery.include).not.toHaveProperty('kyc');
    expect(detailQuery.include).not.toHaveProperty('taxProfile');
    expect(detail.reviews).toEqual([
      {
        rating: 5,
        comment: 'Great service.',
        managedByAdmin: true,
        createdAt: '2026-06-01T00:00:00.000Z',
      },
    ]);
  });
});

describe('ProvidersService public Partner directory', () => {
  it('paginates approved public profiles and returns only a derived district label', async () => {
    const prisma = {
      providerProfile: {
        count: vi.fn().mockResolvedValue(49),
        findMany: vi.fn().mockResolvedValue([
          nearbyProviderFixture({
            city: 'Ho Chi Minh City',
            residentialAddress: 'Private building, District 1, Ho Chi Minh City',
          }),
        ]),
      },
    };
    const service = new ProvidersService(prisma as never, {} as never, {} as never);

    const result = await service.listPublicDirectory({
      city: 'ho-chi-minh',
      district: 'district-1',
      page: '2',
      take: '999',
    });
    const serialized = JSON.stringify(result);

    expect(result.pagination).toEqual({
      page: 2,
      pageSize: 48,
      total: 49,
      totalPages: 2,
    });
    expect(result.items[0].location).toEqual({
      citySlug: 'ho-chi-minh',
      cityLabel: 'Ho Chi Minh City',
      districtSlug: 'district-1',
      districtLabel: 'District 1',
    });
    expect(serialized).not.toContain('Private building');
    expect(prisma.providerProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 48,
        take: 48,
        select: expect.objectContaining({
          user: expect.any(Object),
          residentialAddress: true,
        }),
      }),
    );
  });
});

describe('ProvidersService location updates', () => {
  it('links action-time partner location snapshots to the booking context', async () => {
    const setProviderLocation = vi.fn();
    const getProviderLocation = vi.fn().mockResolvedValue(null);
    const prisma = {
      booking: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'booking-1', status: BookingStatus.IN_SERVICE, snapshots: [] }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          blockedAt: null,
          blockedReason: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'partner-1',
          currentLat: 10.7769,
          currentLng: 106.7009,
          currentLocationUpdatedAt: new Date('2026-06-19T08:00:00.000Z'),
        }),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      { getProviderLocation, setProviderLocation } as never,
      { get: vi.fn() } as never,
    );

    await service.updateLocation('provider-user-1', {
      addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
      bookingId: 'booking-1',
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'booking-1',
        OR: [
          { selectedProviderId: 'partner-1' },
          { participants: { some: { providerProfileId: 'partner-1' } } },
        ],
      },
      select: {
        id: true,
        status: true,
        snapshots: {
          where: { providerProfileId: 'partner-1' },
          select: { id: true },
          take: 1,
        },
      },
    });
    expect(prisma.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationSnapshots: {
            create: expect.objectContaining({
              addressText: '85/9 Pham Viet Chanh, Ho Chi Minh City',
              bookingId: 'booking-1',
              lat: 10.7769,
              lng: 106.7009,
            }),
          },
        }),
      }),
    );
  });

  it('rejects booking-linked partner locations for unrelated bookings', async () => {
    const prisma = {
      booking: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          blockedAt: null,
          blockedReason: null,
        }),
        update: vi.fn(),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      { setProviderLocation: vi.fn() } as never,
      { get: vi.fn() } as never,
    );

    await expect(
      service.updateLocation('provider-user-1', {
        bookingId: 'other-booking',
        lat: 10.7769,
        lng: 106.7009,
      }),
    ).rejects.toThrow('Partner location booking context is invalid');
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it('rejects booking-linked partner locations after the booking is no longer active', async () => {
    const prisma = {
      booking: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: 'booking-1', status: BookingStatus.COMPLETED, snapshots: [] }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          blockedAt: null,
          blockedReason: null,
        }),
        update: vi.fn(),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      { getProviderLocation: vi.fn(), setProviderLocation: vi.fn() } as never,
      { get: vi.fn() } as never,
    );

    await expect(
      service.updateLocation('provider-user-1', {
        bookingId: 'booking-1',
        lat: 10.7769,
        lng: 106.7009,
      }),
    ).rejects.toThrow('Partner location booking context is inactive');
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
  });

  it('skips too-frequent idle partner location writes before touching Postgres', async () => {
    const now = new Date();
    const getProviderLocation = vi.fn().mockResolvedValue({
      lat: 10.7769,
      lng: 106.7009,
      recordedAt: now.toISOString(),
    });
    const setProviderLocation = vi.fn();
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          blockedAt: null,
          blockedReason: null,
          currentLocationUpdatedAt: now,
        }),
        update: vi.fn(),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      { getProviderLocation, setProviderLocation } as never,
      { get: vi.fn() } as never,
    );

    const result = await service.updateLocation('provider-user-1', {
      lat: 10.7769,
      lng: 106.701,
    });

    expect(result).toEqual(
      expect.objectContaining({
        locationUpdated: false,
        locationUpdateSkippedReason: 'TOO_FREQUENT_IDLE_LOCATION_UPDATE',
      }),
    );
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
    expect(setProviderLocation).not.toHaveBeenCalled();
  });

  it('skips too-frequent active booking partner location writes before touching Postgres', async () => {
    const now = new Date();
    const getProviderLocation = vi.fn().mockResolvedValue({
      lat: 10.7769,
      lng: 106.7009,
      recordedAt: now.toISOString(),
    });
    const setProviderLocation = vi.fn();
    const prisma = {
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.IN_SERVICE,
          snapshots: [{ id: 'snapshot-1' }],
        }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          blockedAt: null,
          blockedReason: null,
          currentLocationUpdatedAt: now,
        }),
        update: vi.fn(),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      { getProviderLocation, setProviderLocation } as never,
      { get: vi.fn() } as never,
    );

    const result = await service.updateLocation('provider-user-1', {
      bookingId: 'booking-1',
      lat: 10.7769,
      lng: 106.7409,
    });

    expect(result).toEqual(
      expect.objectContaining({
        locationUpdated: false,
        locationUpdateSkippedReason: 'TOO_FREQUENT_ACTIVE_BOOKING_LOCATION_UPDATE',
      }),
    );
    expect(prisma.providerProfile.update).not.toHaveBeenCalled();
    expect(setProviderLocation).not.toHaveBeenCalled();
  });

  it('stores the first booking-linked location even after a recent idle location update', async () => {
    const now = new Date();
    const getProviderLocation = vi.fn().mockResolvedValue({
      lat: 10.7769,
      lng: 106.7009,
      recordedAt: now.toISOString(),
    });
    const setProviderLocation = vi.fn();
    const prisma = {
      booking: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.ARRIVED,
          snapshots: [],
        }),
      },
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'partner-1',
          blockedAt: null,
          blockedReason: null,
          currentLocationUpdatedAt: now,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'partner-1',
          currentLat: 10.7769,
          currentLng: 106.7009,
          currentLocationUpdatedAt: now,
        }),
      },
    };
    const service = new ProvidersService(
      prisma as never,
      { getProviderLocation, setProviderLocation } as never,
      { get: vi.fn() } as never,
    );

    const result = await service.updateLocation('provider-user-1', {
      bookingId: 'booking-1',
      lat: 10.7769,
      lng: 106.7009,
    });

    expect(result).toEqual(expect.objectContaining({ locationUpdated: true }));
    expect(getProviderLocation).not.toHaveBeenCalled();
    expect(prisma.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          locationSnapshots: {
            create: expect.objectContaining({
              bookingId: 'booking-1',
              lat: 10.7769,
              lng: 106.7009,
            }),
          },
        }),
      }),
    );
    expect(setProviderLocation).toHaveBeenCalled();
  });
});

describe('ProvidersService service menu pricing', () => {
  it('rejects partner prices at 2x or more than the admin base price', async () => {
    const prisma = createProviderServicePricingPrisma({
      service: {
        id: 'service-1',
        basePrice: 300000,
        priceStep: 100000,
        payoutRules: [{ customerPrice: 500000 }],
      },
    });
    const service = createProviderService(prisma);

    await expect(
      service.updateServicePrice('provider-user-1', 'service-1', {
        active: true,
        price: 600000,
      }),
    ).rejects.toThrow('Partner service price cannot be 2x or more than the admin minimum');
    expect(prisma.providerService.upsert).not.toHaveBeenCalled();
  });

  it('allows partner prices below 2x when the admin payout rule exists', async () => {
    const prisma = createProviderServicePricingPrisma({
      service: {
        id: 'service-1',
        basePrice: 300000,
        priceStep: 100000,
        payoutRules: [{ customerPrice: 500000 }],
      },
    });
    const service = createProviderService(prisma);

    await service.updateServicePrice('provider-user-1', 'service-1', {
      active: true,
      price: 500000,
    });

    expect(prisma.providerService.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          price: 500000,
        }),
        update: expect.objectContaining({
          price: 500000,
        }),
      }),
    );
  });
});

describe('ProvidersService availability schedule', () => {
  it('lets an inactive Partner manually return online without waiting for old telemetry', async () => {
    const staleAt = new Date('2026-07-01T00:00:00.000Z');
    const provider = {
      id: 'partner-1',
      availabilityChangedAt: staleAt,
      availabilityIntent: ProviderAvailabilityIntent.OFFLINE,
      availabilityReason: ProviderAvailabilityReason.INACTIVE_7D,
      blockedAt: null,
      blockedReason: null,
      currentLocationUpdatedAt: staleAt,
      selectedBookings: [],
      sessions: [],
      status: ProviderStatus.OFFLINE,
      user: {
        appSessions: [],
        appUsageDailyAggregates: [],
        createdAt: staleAt,
      },
      workingHours: [],
      workingHoursTimezone: 'Asia/Ho_Chi_Minh',
    };
    const prisma = {
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(provider),
        update: vi.fn().mockImplementation(({ data }) => Promise.resolve({ ...provider, ...data })),
      },
    };
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = new ProvidersService(prisma as never, redisState as never, { get: vi.fn() } as never);

    const result = await service.setStatus('provider-user-1', ProviderStatus.ONLINE_AVAILABLE);

    expect(prisma.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
          availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
          status: ProviderStatus.ONLINE_AVAILABLE,
        }),
      }),
    );
    expect(redisState.setProviderStatus).toHaveBeenCalledWith(provider.id, ProviderStatus.ONLINE_AVAILABLE);
    expect(result.status).toBe(ProviderStatus.ONLINE_AVAILABLE);
  });

  it('replaces the weekly schedule atomically and synchronizes effective status', async () => {
    const now = new Date();
    const workingHours = Array.from({ length: 7 }, (_, index) => ({
      weekday: index + 1,
      enabled: true,
      startMinute: 0,
      endMinute: 1440,
    }));
    const provider = {
      id: 'partner-1',
      availabilityChangedAt: new Date('2026-07-19T00:00:00.000Z'),
      availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
      availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
      blockedAt: null,
      blockedReason: null,
      selectedBookings: [],
      status: ProviderStatus.ONLINE_AVAILABLE,
      user: { appUsageDailyAggregates: [{ lastOccurredAt: now }] },
      workingHours: [],
      workingHoursTimezone: 'Asia/Ho_Chi_Minh',
    };
    const transaction = {
      providerWorkingHour: {
        createMany: vi.fn().mockResolvedValue({ count: 7 }),
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
      providerProfile: {
        update: vi.fn().mockImplementation(({ data }) => ({
          ...provider,
          ...data,
          workingHours,
        })),
      },
    };
    const prisma = {
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
      providerProfile: {
        findUnique: vi.fn().mockResolvedValue(provider),
      },
    };
    const redisState = { setProviderStatus: vi.fn().mockResolvedValue(undefined) };
    const service = new ProvidersService(prisma as never, redisState as never, { get: vi.fn() } as never);

    const result = await service.updateAvailability('provider-user-1', { workingHours });

    expect(transaction.providerWorkingHour.deleteMany).toHaveBeenCalledWith({
      where: { providerProfileId: 'partner-1' },
    });
    expect(transaction.providerWorkingHour.createMany).toHaveBeenCalledWith({
      data: workingHours.map((row) => ({ ...row, providerProfileId: 'partner-1' })),
    });
    expect(transaction.providerProfile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          availabilityIntent: ProviderAvailabilityIntent.AVAILABLE,
          availabilityReason: ProviderAvailabilityReason.MANUAL_AVAILABLE,
          status: ProviderStatus.ONLINE_AVAILABLE,
          workingHoursTimezone: 'Asia/Ho_Chi_Minh',
        }),
      }),
    );
    expect(redisState.setProviderStatus).toHaveBeenCalledWith('partner-1', ProviderStatus.ONLINE_AVAILABLE);
    expect(result).toEqual(
      expect.objectContaining({
        scheduleConfigured: true,
        status: ProviderStatus.ONLINE_AVAILABLE,
        withinWorkingHours: true,
        workingHours,
      }),
    );
  });
});

function createServiceWithNearbyProviders(providers: unknown[]) {
  return new ProvidersService(
    nearbyDiscoveryPrisma(providers) as never,
    {} as never,
    {
      get: vi.fn(),
    } as never,
  );
}

function verificationTransactionFixture(eligibleFileIds: string[]) {
  return {
    providerVerification: {
      upsert: vi.fn().mockResolvedValue({ id: 'verification-1', providerProfileId: 'provider-1' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'verification-1', files: [] }),
    },
    fileAsset: {
      findMany: vi.fn().mockResolvedValue(eligibleFileIds.map((id) => ({ id }))),
      updateMany: vi.fn().mockResolvedValue({ count: eligibleFileIds.length }),
    },
  };
}

function nearbyDiscoveryPrisma(
  providers: unknown[],
  policySettings: Array<{ key: string; value: unknown }> = [],
) {
  return {
    operationalPolicySetting: {
      findMany: vi.fn().mockResolvedValue(policySettings),
    },
    providerProfile: {
      findMany: vi.fn().mockResolvedValue(providers),
    },
  };
}

function createProviderService(prisma: ReturnType<typeof createProviderServicePricingPrisma>) {
  return new ProvidersService(
    prisma as never,
    {} as never,
    {
      get: vi.fn(),
    } as never,
  );
}

function createProviderServicePricingPrisma({
  service,
}: {
  service: {
    id: string;
    basePrice: number;
    priceStep: number;
    payoutRules: Array<{ customerPrice: number }>;
  };
}) {
  return {
    providerProfile: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'partner-1',
        blockedAt: null,
        blockedReason: null,
      }),
    },
    massageService: {
      findFirst: vi.fn().mockResolvedValue(service),
    },
    providerService: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({
        id: 'provider-service-1',
        providerProfileId: 'partner-1',
        serviceId: service.id,
        price: 500000,
        active: true,
        service,
      }),
    },
  };
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
    _count: { selectedBookings: 0 },
    ...overrides,
  };
}

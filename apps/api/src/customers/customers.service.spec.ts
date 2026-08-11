import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppUsageEventType, AppUsageOrigin, BookingStatus, Role } from '@prisma/client';

import { CustomersService } from './customers.service';

describe('CustomersService reviews', () => {
  it('creates a published review, trims empty comment to null, and recalculates published rating only', async () => {
    const tx = {
      review: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 'review-1',
          bookingId: 'booking-1',
          status: 'PUBLISHED',
        }),
        aggregate: vi.fn().mockResolvedValue({
          _avg: { rating: 4.5 },
          _count: { rating: 2 },
        }),
      },
      providerProfile: {
        update: vi.fn().mockResolvedValue({ id: 'partner-1' }),
      },
    };

    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.COMPLETED,
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    const service = new CustomersService(prisma as never);

    await expect(
      service.createReview('user-1', {
        bookingId: 'booking-1',
        rating: 5,
        comment: '   ',
      }),
    ).resolves.toMatchObject({
      id: 'review-1',
      status: 'PUBLISHED',
    });

    expect(tx.review.findUnique).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1' },
    });
    expect(tx.review.create).toHaveBeenCalledWith({
      data: {
        bookingId: 'booking-1',
        comment: null,
        customerProfileId: 'customer-1',
        providerProfileId: 'partner-1',
        rating: 5,
      },
    });
    expect(tx.review.aggregate).toHaveBeenCalledWith({
      where: { providerProfileId: 'partner-1', status: 'PUBLISHED' },
      _avg: { rating: true },
      _count: { rating: true },
    });
    expect(tx.providerProfile.update).toHaveBeenCalledWith({
      where: { id: 'partner-1' },
      data: {
        ratingAvg: 4.5,
        reviewCount: 2,
      },
    });
  });

  it('rejects duplicate review creation for the same booking with a clear error', async () => {
    const tx = {
      review: {
        findUnique: vi.fn().mockResolvedValue({ id: 'review-existing' }),
        create: vi.fn(),
        aggregate: vi.fn(),
      },
      providerProfile: {
        update: vi.fn(),
      },
    };

    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.COMPLETED,
        }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
    };

    const service = new CustomersService(prisma as never);

    await expect(
      service.createReview('user-1', {
        bookingId: 'booking-1',
        rating: 4,
        comment: 'Helpful service',
      }),
    ).rejects.toThrow(new BadRequestException('Review already exists for this booking'));

    expect(tx.review.create).not.toHaveBeenCalled();
    expect(tx.review.aggregate).not.toHaveBeenCalled();
    expect(tx.providerProfile.update).not.toHaveBeenCalled();
  });
});

describe('CustomersService favorite partners', () => {
  it('lists favorite partners for the authenticated customer', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerFavoriteProvider: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'favorite-1',
            providerProfileId: 'partner-1',
          },
        ]),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.listFavoriteProviders('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'favorite-1',
        providerProfileId: 'partner-1',
      }),
    ]);

    expect(prisma.customerProfile.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
    expect(prisma.customerFavoriteProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerProfileId: 'customer-1' },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );
  });

  it('saves a favorite partner with an idempotent upsert', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      customerFavoriteProvider: {
        upsert: vi.fn().mockResolvedValue({
          id: 'favorite-1',
          providerProfileId: 'partner-1',
        }),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.setFavoriteProvider('user-1', 'partner-1', true)).resolves.toMatchObject({
      favorite: true,
      providerProfileId: 'partner-1',
      record: {
        id: 'favorite-1',
        providerProfileId: 'partner-1',
      },
    });

    expect(prisma.providerProfile.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'partner-1',
        blockedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(prisma.customerFavoriteProvider.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerProfileId_providerProfileId: {
            customerProfileId: 'customer-1',
            providerProfileId: 'partner-1',
          },
        },
        create: {
          customerProfileId: 'customer-1',
          providerProfileId: 'partner-1',
        },
        update: {},
      }),
    );
  });

  it('removes a favorite partner without touching other favorite rows', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      customerFavoriteProvider: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.setFavoriteProvider('user-1', 'partner-1', false)).resolves.toEqual({
      favorite: false,
      providerProfileId: 'partner-1',
    });

    expect(prisma.customerFavoriteProvider.deleteMany).toHaveBeenCalledWith({
      where: {
        customerProfileId: 'customer-1',
        providerProfileId: 'partner-1',
      },
    });
  });

  it('rejects favorite changes for a missing or unavailable partner', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      customerFavoriteProvider: {
        upsert: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.setFavoriteProvider('user-1', 'missing-partner', true)).rejects.toThrow(
      new NotFoundException('Partner profile not found'),
    );

    expect(prisma.customerFavoriteProvider.upsert).not.toHaveBeenCalled();
    expect(prisma.customerFavoriteProvider.deleteMany).not.toHaveBeenCalled();
  });
});

describe('CustomersService customer home summary', () => {
  it('returns the customer wallet and public partner shortcuts ordered by distance', async () => {
    const partner = (
      id: string,
      displayName: string,
      currentLat: number,
      currentLng: number,
      profileImageUrl: string | null = null,
    ) => ({
      id,
      displayName,
      status: 'OFFLINE',
      ratingAvg: 4.8,
      reviewCount: 12,
      currentLat,
      currentLng,
      user: {
        fullName: `${displayName} Legal`,
        fileAssets: profileImageUrl ? [{ purpose: 'PROFILE_IMAGE', url: profileImageUrl }] : [],
      },
    });
    const nearPartner = partner(
      'partner-near',
      'Near partner',
      10.777,
      106.701,
      'https://cdn.example.com/near.jpg',
    );
    const farPartner = partner('partner-far', 'Far partner', 10.85, 106.8);
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 350000 } }),
      },
      customerFavoriteProvider: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ providerProfile: farPartner }, { providerProfile: nearPartner }]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([
          {
            closedAt: new Date('2026-07-20T10:00:00.000Z'),
            updatedAt: new Date('2026-07-20T10:00:00.000Z'),
            selectedProvider: farPartner,
          },
          {
            closedAt: new Date('2026-07-18T10:00:00.000Z'),
            updatedAt: new Date('2026-07-18T10:00:00.000Z'),
            selectedProvider: nearPartner,
          },
          {
            closedAt: new Date('2026-07-10T10:00:00.000Z'),
            updatedAt: new Date('2026-07-10T10:00:00.000Z'),
            selectedProvider: nearPartner,
          },
        ]),
      },
    };

    const service = new CustomersService(prisma as never);
    const summary = await service.getHomeSummary('user-1', 10.7769, 106.7009);

    expect(summary.wallet).toEqual({ balance: 350000, currency: 'VND' });
    expect(summary.favoritePartners.map((item) => item.id)).toEqual(['partner-near', 'partner-far']);
    expect(summary.completedPartners.map((item) => item.id)).toEqual(['partner-near', 'partner-far']);
    expect(summary.completedPartners).toHaveLength(2);
    expect(summary.favoritePartners[0]).toMatchObject({
      displayName: 'Near partner',
      profileImageUrl: 'https://cdn.example.com/near.jpg',
    });
    expect(summary.favoritePartners[0]).not.toHaveProperty('currentLat');
    expect(summary.favoritePartners[0]).not.toHaveProperty('currentLng');
    expect(summary.favoritePartners[0]).not.toHaveProperty('user');
    expect(summary.completedPartners[0]).toHaveProperty('lastCompletedAt', '2026-07-18T10:00:00.000Z');
  });

  it('returns a zero VND balance and empty rows when the customer has no history', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: null } }),
      },
      customerFavoriteProvider: {
        findMany: vi.fn().mockResolvedValue([]),
      },
      booking: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.getHomeSummary('user-1', 10.7769, 106.7009)).resolves.toEqual({
      wallet: { balance: 0, currency: 'VND' },
      favoritePartners: [],
      completedPartners: [],
    });
  });
});

describe('CustomersService customer wallet', () => {
  it('returns only the authenticated customer balance and recent safe ledger fields', async () => {
    const createdAt = new Date('2026-07-28T03:00:00.000Z');
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerWalletLedgerEntry: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 170000 } }),
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'wallet-entry-1',
            bookingId: null,
            referralRewardId: 'reward-1',
            type: 'REFERRAL_REWARD',
            amount: 70000,
            currency: 'VND',
            reference: 'Referral reward',
            createdAt,
          },
        ]),
      },
    };
    const service = new CustomersService(prisma as never);

    await expect(service.getWallet('user-1')).resolves.toEqual({
      balance: 170000,
      currency: 'VND',
      entries: [
        {
          id: 'wallet-entry-1',
          bookingId: null,
          referralRewardId: 'reward-1',
          type: 'REFERRAL_REWARD',
          amount: 70000,
          currency: 'VND',
          reference: 'Referral reward',
          createdAt: '2026-07-28T03:00:00.000Z',
        },
      ],
    });
    expect(prisma.customerWalletLedgerEntry.findMany).toHaveBeenCalledWith({
      where: { customerProfileId: 'customer-1' },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        bookingId: true,
        referralRewardId: true,
        type: true,
        amount: true,
        currency: true,
        reference: true,
        createdAt: true,
      },
    });
  });
});

describe('CustomersService viewed partners', () => {
  it('lists recently viewed partners for the authenticated customer', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerProviderProfileView: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'view-1',
            providerProfileId: 'partner-1',
            viewCount: 2,
          },
        ]),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.listViewedProviders('user-1')).resolves.toEqual([
      expect.objectContaining({
        id: 'view-1',
        providerProfileId: 'partner-1',
        viewCount: 2,
      }),
    ]);

    expect(prisma.customerProviderProfileView.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { customerProfileId: 'customer-1' },
        orderBy: { lastViewedAt: 'desc' },
        take: 100,
      }),
    );
  });

  it('records a partner profile view with an idempotent count update', async () => {
    const now = new Date('2026-06-22T09:30:00.000Z');
    vi.useFakeTimers().setSystemTime(now);
    const transaction = {
      appUsageDailyAggregate: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({ id: 'daily-1' }),
      },
      appUsageEvent: {
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
        findUnique: vi.fn().mockResolvedValue(null),
      },
      customerProviderProfileView: {
        findUniqueOrThrow: vi.fn(),
        upsert: vi.fn().mockResolvedValue({
          id: 'view-1',
          providerProfileId: 'partner-1',
          viewCount: 3,
          lastViewedAt: now,
        }),
      },
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'user-1' }),
      },
      providerProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };

    const service = new CustomersService(prisma as never);

    await expect(
      service.recordProviderProfileView('user-1', 'partner-1', 'profile-view-1'),
    ).resolves.toMatchObject({
      id: 'view-1',
      providerProfileId: 'partner-1',
      viewCount: 3,
    });

    expect(prisma.providerProfile.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'partner-1',
        blockedAt: null,
        deletedAt: null,
      },
      select: { id: true },
    });
    expect(transaction.customerProviderProfileView.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          customerProfileId_providerProfileId: {
            customerProfileId: 'customer-1',
            providerProfileId: 'partner-1',
          },
        },
        create: {
          customerProfileId: 'customer-1',
          providerProfileId: 'partner-1',
          firstViewedAt: now,
          lastViewedAt: now,
          viewCount: 1,
        },
        update: {
          lastViewedAt: now,
          viewCount: { increment: 1 },
        },
      }),
    );
    expect(transaction.appUsageEvent.create).toHaveBeenCalledWith({
      data: {
        clientEventId: 'profile-view-1',
        eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
        occurredAt: now,
        origin: AppUsageOrigin.PRODUCTION,
        role: Role.CUSTOMER,
        subjectId: 'partner-1',
        subjectType: 'PROVIDER_PROFILE',
        userId: 'user-1',
      },
      select: { id: true },
    });
    expect(transaction.appUsageDailyAggregate.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          providerProfileViewCount: 1,
          totalEventCount: 1,
          userId: 'user-1',
        }),
      }),
    );
    expect(transaction.appUsageDailyAggregate.updateMany).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });

  it('does not increment the profile aggregate again when the same view event is retried', async () => {
    const existingView = {
      id: 'view-1',
      providerProfileId: 'partner-1',
      viewCount: 3,
    };
    const transaction = {
      appUsageDailyAggregate: { updateMany: vi.fn(), upsert: vi.fn() },
      appUsageEvent: {
        create: vi.fn(),
        findUnique: vi.fn().mockResolvedValue({
          eventType: AppUsageEventType.PROVIDER_PROFILE_VIEW,
          userId: 'user-1',
        }),
      },
      customerProviderProfileView: {
        findUniqueOrThrow: vi.fn().mockResolvedValue(existingView),
        upsert: vi.fn(),
      },
    };
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'customer-1', userId: 'user-1' }),
      },
      providerProfile: {
        findFirst: vi.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      $transaction: vi.fn(async (callback: (client: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new CustomersService(prisma as never);

    await expect(service.recordProviderProfileView('user-1', 'partner-1', 'profile-view-1')).resolves.toBe(
      existingView,
    );

    expect(transaction.customerProviderProfileView.upsert).not.toHaveBeenCalled();
    expect(transaction.appUsageEvent.create).not.toHaveBeenCalled();
    expect(transaction.appUsageDailyAggregate.upsert).not.toHaveBeenCalled();
  });
});

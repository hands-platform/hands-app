import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';

import { CustomersService } from './customers.service';

describe('CustomersService reviews', () => {
  it('creates a published review, trims empty comment to null, and recalculates published rating only', async () => {
    const tx = {
      review: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({
          id: 'review-1',
          bookingId: 'booking-1',
          status: 'PUBLISHED',
        }),
        aggregate: jest.fn().mockResolvedValue({
          _avg: { rating: 4.5 },
          _count: { rating: 2 },
        }),
      },
      providerProfile: {
        update: jest.fn().mockResolvedValue({ id: 'partner-1' }),
      },
    };

    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.COMPLETED,
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
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
        findUnique: jest.fn().mockResolvedValue({ id: 'review-existing' }),
        create: jest.fn(),
        aggregate: jest.fn(),
      },
      providerProfile: {
        update: jest.fn(),
      },
    };

    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      booking: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'booking-1',
          customerProfileId: 'customer-1',
          selectedProviderId: 'partner-1',
          status: BookingStatus.COMPLETED,
        }),
      },
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
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
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerFavoriteProvider: {
        findMany: jest.fn().mockResolvedValue([
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
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      customerFavoriteProvider: {
        upsert: jest.fn().mockResolvedValue({
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
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      customerFavoriteProvider: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
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
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      customerFavoriteProvider: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
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

describe('CustomersService viewed partners', () => {
  it('lists recently viewed partners for the authenticated customer', async () => {
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerProviderProfileView: {
        findMany: jest.fn().mockResolvedValue([
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
    jest.useFakeTimers().setSystemTime(now);
    const prisma = {
      customerProfile: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      providerProfile: {
        findFirst: jest.fn().mockResolvedValue({ id: 'partner-1' }),
      },
      customerProviderProfileView: {
        upsert: jest.fn().mockResolvedValue({
          id: 'view-1',
          providerProfileId: 'partner-1',
          viewCount: 3,
          lastViewedAt: now,
        }),
      },
    };

    const service = new CustomersService(prisma as never);

    await expect(service.recordProviderProfileView('user-1', 'partner-1')).resolves.toMatchObject({
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
    expect(prisma.customerProviderProfileView.upsert).toHaveBeenCalledWith(
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

    jest.useRealTimers();
  });
});

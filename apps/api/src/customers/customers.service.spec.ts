import { BadRequestException } from '@nestjs/common';
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

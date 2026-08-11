import { BookingStatus, PaymentStatus, Prisma } from '@prisma/client';
import { BookingTimeoutProcessor } from './matching.processor';

describe('BookingTimeoutProcessor', () => {
  it('does not expire or refund when matching wins the timeout race', async () => {
    const raceError = new Prisma.PrismaClientKnownRequestError(
      'No booking matched the timeout condition',
      { code: 'P2025', clientVersion: 'test' },
    );
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'partner-1',
          expiresAt: new Date(Date.now() - 1_000),
          payment: { id: 'payment-1', status: PaymentStatus.AUTHORIZED },
        }),
        update: vi.fn().mockRejectedValue(raceError),
      },
    };
    const redisState = { closeMatching: vi.fn() };
    const gateway = { emitBookingExpired: vi.fn() };
    const payments = { closeUnmatchedBookingPayment: vi.fn() };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      payments as never,
    );

    await expect(
      processor.process({ data: { bookingId: 'booking-1' } } as never),
    ).resolves.toEqual({ skipped: true });

    expect(payments.closeUnmatchedBookingPayment).not.toHaveBeenCalled();
    expect(redisState.closeMatching).not.toHaveBeenCalled();
    expect(gateway.emitBookingExpired).not.toHaveBeenCalled();
  });

  it('retries payment release for an already persisted timeout without emitting it twice', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.EXPIRED,
          closedReason: 'preferred_provider_no_response',
          payment: { id: 'payment-1', status: PaymentStatus.AUTHORIZED },
        }),
        update: vi.fn(),
      },
    };
    const redisState = { closeMatching: vi.fn() };
    const gateway = { emitBookingExpired: vi.fn() };
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({ released: true }),
    };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      payments as never,
    );

    await expect(
      processor.process({ data: { bookingId: 'booking-1' } } as never),
    ).resolves.toEqual({ expired: true, bookingId: 'booking-1' });

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledTimes(1);
    expect(redisState.closeMatching).toHaveBeenCalledWith('booking-1');
    expect(gateway.emitBookingExpired).not.toHaveBeenCalled();
  });

  it('queues refund review instead of releasing a captured gateway payment', async () => {
    const responseDeadline = new Date('2026-06-11T01:10:00.000Z');
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'partner-1',
          expiresAt: responseDeadline,
          payment: { id: 'payment-1', status: PaymentStatus.CAPTURED },
        }),
        update: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.EXPIRED,
          payment: { id: 'payment-1', status: PaymentStatus.CAPTURED },
        }),
      },
    };
    const redisState = { closeMatching: vi.fn() };
    const gateway = { emitBookingExpired: vi.fn() };
    const payments = { closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({ refundRequested: true }) };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      payments as never,
    );

    await expect(
      processor.process({ data: { bookingId: 'booking-1' } } as never),
    ).resolves.toEqual({ expired: true, bookingId: 'booking-1' });

    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledWith(
      'payment-1',
      'Payment refund requested because matching expired without a partner',
    );
    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          selectedProviderId: null,
          expiresAt: { lte: expect.any(Date) },
        },
        data: expect.objectContaining({
          status: BookingStatus.EXPIRED,
          closedReason: 'preferred_provider_no_response',
          participants: expect.objectContaining({ updateMany: expect.any(Object) }),
          providerRequestEvents: {
            create: {
              providerProfileId: 'partner-1',
              eventType: 'PREFERRED_PROVIDER_NO_RESPONSE',
              metadata: {
                expiredAt: expect.any(String),
                responseDeadline: responseDeadline.toISOString(),
              },
            },
          },
        }),
      }),
    );
    expect(prisma.booking.update.mock.calls[0]?.[0]?.data).not.toHaveProperty('expiresAt');
  });

  it('records a generic expiry when an open marketplace booking has no preferred partner', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: null,
          expiresAt: new Date(Date.now() - 1_000),
          payment: null,
        }),
        update: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.EXPIRED,
          closedReason: 'matching_request_expired',
          payment: null,
        }),
      },
    };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      { closeMatching: vi.fn() } as never,
      { emitBookingExpired: vi.fn() } as never,
      { closeUnmatchedBookingPayment: vi.fn() } as never,
    );

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as never)).resolves.toEqual({
      expired: true,
      bookingId: 'booking-1',
    });

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closedReason: 'matching_request_expired' }),
      }),
    );
  });
});

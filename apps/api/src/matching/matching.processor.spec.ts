import { BookingStatus, CouponRedemptionState, PaymentStatus, Prisma } from '@prisma/client';
import { BookingTimeoutProcessor } from './matching.processor';

describe('BookingTimeoutProcessor', () => {
  it('does not expire or refund when matching wins the timeout race', async () => {
    const raceError = new Prisma.PrismaClientKnownRequestError('No booking matched the timeout condition', {
      code: 'P2025',
      clientVersion: 'test',
    });
    const prisma = attachTimeoutTransaction({
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
    });
    const redisState = { closeMatching: vi.fn() };
    const gateway = { emitBookingExpired: vi.fn() };
    const payments = { closeUnmatchedBookingPayment: vi.fn() };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      payments as never,
    );

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as never)).resolves.toEqual({
      skipped: true,
    });

    expect(payments.closeUnmatchedBookingPayment).not.toHaveBeenCalled();
    expect(redisState.closeMatching).not.toHaveBeenCalled();
    expect(gateway.emitBookingExpired).not.toHaveBeenCalled();
  });

  it('re-emits expiry while retrying an already persisted timeout', async () => {
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
      adminAuditLog: { upsert: vi.fn() },
    };
    attachTimeoutTransaction(prisma);
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

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as never)).resolves.toEqual({
      expired: true,
      bookingId: 'booking-1',
    });

    expect(prisma.booking.update).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'booking-timeout-payment-closure:booking-1' },
        create: expect.objectContaining({
          actorType: 'SYSTEM',
          action: 'booking.timeout.payment_closure_recorded',
          objectId: 'booking-1',
          outcome: 'SUCCEEDED',
        }),
      }),
    );
    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledTimes(1);
    expect(redisState.closeMatching).toHaveBeenCalledWith('booking-1');
    expect(gateway.emitBookingExpired).toHaveBeenCalledWith(
      'booking-1',
      expect.objectContaining({ status: BookingStatus.EXPIRED }),
    );
  });

  it('recovers a customer cancellation payment closeout from its durable pending task', async () => {
    const booking = {
      id: 'booking-cancelled',
      status: BookingStatus.CANCELLED,
      closedReason: 'customer_cancelled',
      payment: { id: 'payment-1', status: PaymentStatus.AUTHORIZED },
    };
    const prisma = {
      booking: { findUnique: vi.fn().mockResolvedValue(booking), update: vi.fn() },
      bookingOpsTask: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      adminAuditLog: { upsert: vi.fn() },
    };
    attachTimeoutTransaction(prisma);
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

    await expect(processor.process({ data: { bookingId: booking.id } } as never)).resolves.toEqual({
      recovered: true,
      bookingId: booking.id,
    });
    expect(payments.closeUnmatchedBookingPayment).toHaveBeenCalledWith(
      'payment-1',
      'Payment closure recovered after booking cancellation',
    );
    expect(prisma.bookingOpsTask.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: booking.id,
        note: { startsWith: 'Payment closure pending after' },
        status: 'PENDING',
        type: 'PAYMENT_REVIEWED',
      },
      data: {
        status: 'DONE',
        note: 'Payment closure completed after booking cancellation.',
      },
    });
    expect(prisma.adminAuditLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: `booking-cancellation-payment-closure:${booking.id}` },
        create: expect.objectContaining({
          action: 'booking.cancellation.payment_closure_recorded',
          source: 'booking_cancellation_payment_worker',
        }),
      }),
    );
  });

  it('recovers an admin-expired booking payment task and matching projection', async () => {
    const booking = {
      id: 'booking-admin-expired',
      status: BookingStatus.EXPIRED,
      closedReason: 'admin_expired',
      payment: { id: 'payment-1', status: PaymentStatus.AUTHORIZED },
    };
    const prisma = {
      booking: { findUnique: vi.fn().mockResolvedValue(booking), update: vi.fn() },
      bookingOpsTask: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      adminAuditLog: { upsert: vi.fn() },
    };
    attachTimeoutTransaction(prisma);
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

    await expect(processor.process({ data: { bookingId: booking.id } } as never)).resolves.toEqual({
      expired: true,
      bookingId: booking.id,
    });

    expect(prisma.bookingOpsTask.updateMany).toHaveBeenCalledWith({
      where: {
        bookingId: booking.id,
        note: { startsWith: 'Booking closeout is pending' },
        status: 'PENDING',
        type: 'PAYMENT_REVIEWED',
      },
      data: {
        status: 'DONE',
        note: 'Payment closure completed after matching expiration.',
      },
    });
    expect(redisState.closeMatching).toHaveBeenCalledWith(booking.id);
    expect(gateway.emitBookingExpired).toHaveBeenCalledWith(booking.id, booking);
  });

  it('keeps admin expiry recovery pending until realtime succeeds', async () => {
    const booking = {
      id: 'booking-admin-expired-retry',
      status: BookingStatus.EXPIRED,
      closedReason: 'admin_expired',
      payment: { id: 'payment-1', status: PaymentStatus.AUTHORIZED },
    };
    const prisma = {
      booking: { findUnique: vi.fn().mockResolvedValue(booking), update: vi.fn() },
      bookingOpsTask: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      adminAuditLog: { upsert: vi.fn() },
    };
    attachTimeoutTransaction(prisma);
    const redisState = { closeMatching: vi.fn() };
    const gateway = {
      emitBookingExpired: vi
        .fn()
        .mockRejectedValueOnce(new Error('Realtime unavailable'))
        .mockResolvedValueOnce(undefined),
    };
    const payments = {
      closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({ released: true }),
    };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      payments as never,
    );
    const job = { data: { bookingId: booking.id } } as never;

    await expect(processor.process(job)).rejects.toThrow('Realtime unavailable');
    expect(prisma.bookingOpsTask.updateMany).not.toHaveBeenCalled();
    expect(prisma.adminAuditLog.upsert).not.toHaveBeenCalled();

    await expect(processor.process(job)).resolves.toEqual({
      expired: true,
      bookingId: booking.id,
    });
    expect(prisma.bookingOpsTask.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.adminAuditLog.upsert).toHaveBeenCalledTimes(1);
  });

  it('does not record timeout recovery complete until realtime succeeds', async () => {
    const booking = {
      id: 'booking-realtime-retry',
      status: BookingStatus.EXPIRED,
      closedReason: 'matching_request_expired',
      payment: null,
    };
    const prisma = {
      booking: { findUnique: vi.fn().mockResolvedValue(booking), update: vi.fn() },
      adminAuditLog: { upsert: vi.fn() },
    };
    attachTimeoutTransaction(prisma);
    const redisState = { closeMatching: vi.fn() };
    const gateway = {
      emitBookingExpired: vi
        .fn()
        .mockRejectedValueOnce(new Error('Realtime unavailable'))
        .mockResolvedValueOnce(undefined),
    };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      { closeUnmatchedBookingPayment: vi.fn() } as never,
    );
    const job = { data: { bookingId: booking.id } } as never;

    await expect(processor.process(job)).rejects.toThrow('Realtime unavailable');
    expect(prisma.adminAuditLog.upsert).not.toHaveBeenCalled();

    await expect(processor.process(job)).resolves.toEqual({
      expired: true,
      bookingId: booking.id,
    });
    expect(gateway.emitBookingExpired).toHaveBeenCalledTimes(2);
    expect(prisma.adminAuditLog.upsert).toHaveBeenCalledTimes(1);
  });

  it('queues refund review instead of releasing a captured gateway payment', async () => {
    const responseDeadline = new Date('2026-06-11T01:10:00.000Z');
    const prisma = attachTimeoutTransaction({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: 'partner-1',
          expiresAt: responseDeadline,
          payment: { id: 'payment-1', status: PaymentStatus.CAPTURED },
        }),
        update: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            status: BookingStatus.EXPIRED,
            payment: { id: 'payment-1', status: PaymentStatus.CAPTURED },
          })
          .mockResolvedValueOnce({ id: 'booking-1' }),
      },
      adminAuditLog: { upsert: vi.fn() },
    });
    const redisState = { closeMatching: vi.fn() };
    const gateway = { emitBookingExpired: vi.fn() };
    const payments = { closeUnmatchedBookingPayment: vi.fn().mockResolvedValue({ refundRequested: true }) };
    const processor = new BookingTimeoutProcessor(
      prisma as never,
      redisState as never,
      gateway as never,
      payments as never,
    );

    await expect(processor.process({ data: { bookingId: 'booking-1' } } as never)).resolves.toEqual({
      expired: true,
      bookingId: 'booking-1',
    });

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
    expect(prisma.adminAuditLog.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          outcome: 'OPENED',
          metadata: expect.objectContaining({ refundRequested: true }),
        }),
      }),
    );
  });

  it('records a generic expiry when an open marketplace booking has no preferred partner', async () => {
    const prisma = attachTimeoutTransaction({
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
          preferredProviderId: null,
          expiresAt: new Date(Date.now() - 1_000),
          payment: null,
        }),
        update: vi
          .fn()
          .mockResolvedValueOnce({
            id: 'booking-1',
            status: BookingStatus.EXPIRED,
            closedReason: 'matching_request_expired',
            payment: null,
          })
          .mockResolvedValueOnce({ id: 'booking-1' }),
      },
      adminAuditLog: { upsert: vi.fn() },
    });
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
    expect(prisma.couponRedemption.updateMany).toHaveBeenCalledWith({
      where: { bookingId: 'booking-1', state: CouponRedemptionState.RESERVED },
      data: expect.objectContaining({
        state: CouponRedemptionState.RELEASED,
        releaseReason: 'BOOKING_MATCHING_EXPIRED',
      }),
    });
  });
});

function attachTimeoutTransaction<T extends Record<string, unknown>>(client: T) {
  Object.assign(client, {
    couponRedemption: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    $transaction: vi.fn(async (callback: (tx: T) => Promise<unknown>) => callback(client)),
  });
  return client;
}

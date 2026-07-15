import { BookingStatus, PaymentStatus } from '@prisma/client';
import { BookingTimeoutProcessor } from './matching.processor';

describe('BookingTimeoutProcessor', () => {
  it('queues refund review instead of releasing a captured gateway payment', async () => {
    const prisma = {
      booking: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'booking-1',
          status: BookingStatus.OPEN_MATCHING,
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
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: 'booking-1' },
      data: { status: BookingStatus.EXPIRED },
      include: { payment: true },
    });
  });
});

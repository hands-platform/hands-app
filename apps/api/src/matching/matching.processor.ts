import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BookingStatus } from '@prisma/client';
import { Job } from 'bullmq';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { BOOKING_TIMEOUT_QUEUE_NAME, type BookingTimeoutJob } from './booking-timeout.queue';
import { MatchingGateway } from './matching.gateway';

@Processor(BOOKING_TIMEOUT_QUEUE_NAME)
export class BookingTimeoutProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisState: RedisStateService,
    private readonly gateway: MatchingGateway,
    private readonly payments: PaymentsService,
  ) {
    super();
  }

  async process(job: Job<BookingTimeoutJob>) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: job.data.bookingId },
      include: { payment: true },
    });

    if (!booking || booking.status !== BookingStatus.OPEN_MATCHING) {
      return { skipped: true };
    }

    if (booking.payment) {
      await this.payments.closeUnmatchedBookingPayment(
        booking.payment.id,
        'Payment refund requested because matching expired without a partner',
      );
    }

    const expired = await this.prisma.booking.update({
      where: { id: booking.id },
      data: {
        status: BookingStatus.EXPIRED,
      },
      include: { payment: true },
    });

    await this.redisState.closeMatching(booking.id);
    this.gateway.emitBookingExpired(booking.id, expired);

    return { expired: true, bookingId: booking.id };
  }
}

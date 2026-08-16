import { Processor, WorkerHost } from '@nestjs/bullmq';
import { BookingStatus, ParticipantStatus, Prisma } from '@prisma/client';
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

    if (!booking) {
      return { skipped: true };
    }

    let expired = booking;
    let transitioned = false;
    if (booking.status === BookingStatus.OPEN_MATCHING) {
      const expiredAt = new Date();
      try {
        expired = await this.prisma.booking.update({
          where: {
            id: booking.id,
            status: BookingStatus.OPEN_MATCHING,
            selectedProviderId: null,
            expiresAt: { lte: expiredAt },
          },
          data: {
            status: BookingStatus.EXPIRED,
            closedAt: expiredAt,
            closedReason: booking.preferredProviderId
              ? 'preferred_provider_no_response'
              : 'matching_request_expired',
            participants: {
              updateMany: {
                where: {
                  status: { in: [ParticipantStatus.JOINED, ParticipantStatus.ACCEPTED] },
                },
                data: { status: ParticipantStatus.EXPIRED, respondedAt: expiredAt },
              },
            },
            ...(booking.preferredProviderId
              ? {
                  providerRequestEvents: {
                    create: {
                      providerProfileId: booking.preferredProviderId,
                      eventType: 'PREFERRED_PROVIDER_NO_RESPONSE',
                      metadata: {
                        expiredAt: expiredAt.toISOString(),
                        responseDeadline: booking.expiresAt?.toISOString() ?? null,
                      },
                    },
                  },
                }
              : {}),
          },
          include: { payment: true },
        });
        transitioned = true;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2025') {
          throw error;
        }
        return { skipped: true };
      }
    } else if (
      booking.status !== BookingStatus.EXPIRED ||
      !['preferred_provider_no_response', 'matching_request_expired'].includes(booking.closedReason ?? '')
    ) {
      return { skipped: true };
    }

    if (expired.payment) {
      await this.payments.closeUnmatchedBookingPayment(
        expired.payment.id,
        'Payment refund requested because matching expired without a partner',
      );
    }

    await this.redisState.closeMatching(booking.id);
    if (transitioned) {
      await this.gateway.emitBookingExpired(booking.id, expired);
    }

    return { expired: true, bookingId: booking.id };
  }
}

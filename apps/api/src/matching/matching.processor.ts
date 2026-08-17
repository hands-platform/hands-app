import { Processor, WorkerHost } from '@nestjs/bullmq';
import {
  BookingOpsTaskStatus,
  BookingOpsTaskType,
  BookingStatus,
  ParticipantStatus,
  Prisma,
} from '@prisma/client';
import { Job } from 'bullmq';
import { PaymentsService } from '../payments/payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisStateService } from '../redis/redis-state.service';
import { BOOKING_TIMEOUT_QUEUE_NAME, type BookingTimeoutJob } from './booking-timeout.queue';
import { MatchingGateway } from './matching.gateway';

const RECOVERABLE_CANCELLATION_REASONS = ['customer_cancelled', 'preferred_provider_rejected'] as const;
const CANCELLATION_PAYMENT_PENDING_NOTE = 'Payment closure pending after';

@Processor({ name: BOOKING_TIMEOUT_QUEUE_NAME, configKey: 'worker' })
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

    const cancellationPaymentRecovery =
      booking.status === BookingStatus.CANCELLED &&
      RECOVERABLE_CANCELLATION_REASONS.includes(
        booking.closedReason as (typeof RECOVERABLE_CANCELLATION_REASONS)[number],
      );
    let expired = booking;
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
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2025') {
          throw error;
        }
        return { skipped: true };
      }
    } else if (
      !cancellationPaymentRecovery &&
      (booking.status !== BookingStatus.EXPIRED ||
        !['preferred_provider_no_response', 'matching_request_expired', 'admin_expired'].includes(
          booking.closedReason ?? '',
        ))
    ) {
      return { skipped: true };
    }

    const paymentClosure = expired.payment
      ? await this.payments.closeUnmatchedBookingPayment(
          expired.payment.id,
          cancellationPaymentRecovery
            ? 'Payment closure recovered after booking cancellation'
            : 'Payment refund requested because matching expired without a partner',
        )
      : null;
    await this.redisState.closeMatching(booking.id);
    await this.gateway.emitBookingExpired(booking.id, expired);
    const closureEventId = cancellationPaymentRecovery
      ? `booking-cancellation-payment-closure:${booking.id}`
      : `booking-timeout-payment-closure:${booking.id}`;
    await this.prisma.adminAuditLog.upsert({
      where: { eventId: closureEventId },
      update: {},
      create: {
        eventId: closureEventId,
        actorId: null,
        actorKey: cancellationPaymentRecovery
          ? 'booking-cancellation-payment-worker'
          : 'booking-timeout-worker',
        actorLabelSnapshot: cancellationPaymentRecovery
          ? 'HANDS booking cancellation payment worker'
          : 'HANDS booking timeout worker',
        actorType: 'SYSTEM',
        action: cancellationPaymentRecovery
          ? 'booking.cancellation.payment_closure_recorded'
          : 'booking.timeout.payment_closure_recorded',
        area: 'BOOKING',
        objectId: booking.id,
        objectType: 'Booking',
        outcome: paymentClosure?.refundRequested ? 'OPENED' : 'SUCCEEDED',
        source: cancellationPaymentRecovery
          ? 'booking_cancellation_payment_worker'
          : 'matching_timeout_worker',
        target: `booking:${booking.id}`,
        metadata: {
          bookingId: booking.id,
          paymentId: expired.payment?.id ?? null,
          refundRequested: paymentClosure?.refundRequested ?? false,
          released: paymentClosure?.released ?? false,
        },
      },
    });
    if (cancellationPaymentRecovery) {
      await this.prisma.bookingOpsTask.updateMany({
        where: {
          bookingId: booking.id,
          note: { startsWith: CANCELLATION_PAYMENT_PENDING_NOTE },
          status: BookingOpsTaskStatus.PENDING,
          type: BookingOpsTaskType.PAYMENT_REVIEWED,
        },
        data: {
          status: paymentClosure?.refundRequested
            ? BookingOpsTaskStatus.PENDING
            : BookingOpsTaskStatus.DONE,
          note: paymentClosure?.refundRequested
            ? 'Captured payment refund is pending finance review.'
            : 'Payment closure completed after booking cancellation.',
        },
      });
      return { recovered: true, bookingId: booking.id };
    }
    if (booking.closedReason === 'admin_expired') {
      await this.prisma.bookingOpsTask.updateMany({
        where: {
          bookingId: booking.id,
          note: { startsWith: 'Booking closeout is pending' },
          status: BookingOpsTaskStatus.PENDING,
          type: BookingOpsTaskType.PAYMENT_REVIEWED,
        },
        data: {
          status: paymentClosure?.refundRequested
            ? BookingOpsTaskStatus.PENDING
            : BookingOpsTaskStatus.DONE,
          note: paymentClosure?.refundRequested
            ? 'Captured payment refund is pending finance review.'
            : 'Payment closure completed after matching expiration.',
        },
      });
    }

    return { expired: true, bookingId: booking.id };
  }
}

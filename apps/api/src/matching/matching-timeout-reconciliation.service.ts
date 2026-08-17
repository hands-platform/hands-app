import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BookingStatus } from '@prisma/client';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import {
  BOOKING_TIMEOUT_QUEUE_NAME,
  bookingTimeoutJob,
} from './booking-timeout.queue';

const RECONCILIATION_INTERVAL_MS = 60_000;
const RECONCILIATION_BATCH_SIZE = 100;

@Injectable()
export class BookingTimeoutReconciliationService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(BookingTimeoutReconciliationService.name);
  private cursor: string | undefined;
  private running = false;
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(BOOKING_TIMEOUT_QUEUE_NAME) private readonly queue: Queue,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.runScheduledBatch(), RECONCILIATION_INTERVAL_MS);
    this.timer.unref();
    void this.runScheduledBatch();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async reconcileBatch(now = new Date()) {
    if (this.running) return { failed: 0, scheduled: 0, skipped: true };

    this.running = true;
    try {
      const bookings = await this.prisma.booking.findMany({
        where: {
          AND: [
            {
              OR: [
                {
                  status: BookingStatus.OPEN_MATCHING,
                  selectedProviderId: null,
                  expiresAt: { lte: now },
                },
                {
                  status: BookingStatus.EXPIRED,
                  closedReason: {
                    in: ['preferred_provider_no_response', 'matching_request_expired'],
                  },
                },
              ],
            },
            ...(this.cursor
              ? [
                  {
                    id: { gt: this.cursor },
                  },
                ]
              : []),
          ],
        },
        orderBy: { id: 'asc' },
        take: RECONCILIATION_BATCH_SIZE,
        select: { id: true, expiresAt: true, status: true },
      });

      const completedClosures =
        bookings.length === 0
          ? []
          : await this.prisma.adminAuditLog.findMany({
              where: {
                action: 'booking.timeout.payment_closure_recorded',
                objectId: { in: bookings.map((booking) => booking.id) },
              },
              select: { objectId: true },
            });
      const completedBookingIds = new Set(
        completedClosures.map((event) => event.objectId).filter((id): id is string => Boolean(id)),
      );
      const recoverableBookings = bookings.filter(
        (booking) =>
          booking.status === BookingStatus.OPEN_MATCHING || !completedBookingIds.has(booking.id),
      );
      this.cursor =
        bookings.length === RECONCILIATION_BATCH_SIZE
          ? bookings[bookings.length - 1]?.id
          : undefined;

      const results = await Promise.allSettled(
        recoverableBookings.map((booking) => {
          const job = bookingTimeoutJob(booking.id, booking.expiresAt ?? now);
          return this.queue.add(job.name, job.data, job.options);
        }),
      );
      return {
        failed: results.filter((result) => result.status === 'rejected').length,
        scheduled: results.filter((result) => result.status === 'fulfilled').length,
        skipped: false,
      };
    } finally {
      this.running = false;
    }
  }

  private async runScheduledBatch() {
    try {
      const result = await this.reconcileBatch();
      if (result.failed || result.scheduled) {
        this.logger.log(
          `Booking timeout reconciliation: scheduled=${result.scheduled} failed=${result.failed}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Booking timeout reconciliation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

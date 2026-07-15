import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import {
  PAYMENT_BOOKING_RECOVERY_QUEUE_NAME,
  paymentBookingRecoveryJob,
} from './payment-booking-recovery.queue';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME, type PaymentStatusJob } from './payment-status.queue';
import { PaymentsService } from './payments.service';

@Processor(PAYMENT_STATUS_CHECK_QUEUE_NAME)
export class PaymentStatusProcessor extends WorkerHost {
  constructor(
    private readonly payments: PaymentsService,
    @InjectQueue(PAYMENT_BOOKING_RECOVERY_QUEUE_NAME) private readonly bookingRecoveryQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<PaymentStatusJob>) {
    const result = await this.payments.checkAndSyncStatus(job.data.paymentId);
    if (
      'bookingRecoveryReady' in result &&
      result.bookingRecoveryReady &&
      typeof result.bookingId === 'string'
    ) {
      const recovery = paymentBookingRecoveryJob({
        bookingId: result.bookingId,
        paymentId: job.data.paymentId,
      });
      await this.bookingRecoveryQueue.add(recovery.name, recovery.data, recovery.options);
    }
    return result;
  }
}

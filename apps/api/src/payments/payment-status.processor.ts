import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME, type PaymentStatusJob } from './payment-status.queue';
import { PaymentsService } from './payments.service';

@Processor(PAYMENT_STATUS_CHECK_QUEUE_NAME)
export class PaymentStatusProcessor extends WorkerHost {
  constructor(private readonly payments: PaymentsService) {
    super();
  }

  process(job: Job<PaymentStatusJob>) {
    return this.payments.checkAndSyncStatus(job.data.paymentId);
  }
}

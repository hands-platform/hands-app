import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  PAYMENT_REFUND_STATUS_QUEUE_NAME,
  type PaymentRefundStatusJob,
} from './payment-refund-status.queue';
import { PaymentsService } from './payments.service';

@Processor({ name: PAYMENT_REFUND_STATUS_QUEUE_NAME, configKey: 'worker' })
export class PaymentRefundStatusProcessor extends WorkerHost {
  constructor(private readonly payments: PaymentsService) {
    super();
  }

  async process(job: Job<PaymentRefundStatusJob>) {
    const result = await this.payments.checkAndFinalizeRefund(job.data.refundId);
    if (!result.completed) {
      throw new Error(`Refund ${job.data.refundId} is still processing at the payment provider`);
    }
    return result;
  }
}

const PAYMENT_REFUND_STATUS_DELAY_MS = 60_000;
const PAYMENT_REFUND_STATUS_ATTEMPTS = 30;
const PAYMENT_REFUND_STATUS_BACKOFF_MS = 60_000;

export const PAYMENT_REFUND_STATUS_QUEUE_NAME = 'payment-refund-status';
export const PAYMENT_REFUND_STATUS_JOB_NAME = 'payment-refund-status';

export type PaymentRefundStatusJob = {
  refundId: string;
};

export function paymentRefundStatusJob(refundId: string) {
  return {
    name: PAYMENT_REFUND_STATUS_JOB_NAME,
    data: { refundId },
    options: {
      jobId: `payment-refund-status-${refundId}`,
      delay: PAYMENT_REFUND_STATUS_DELAY_MS,
      attempts: PAYMENT_REFUND_STATUS_ATTEMPTS,
      backoff: { type: 'fixed', delay: PAYMENT_REFUND_STATUS_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
}

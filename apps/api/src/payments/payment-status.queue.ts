const PAYMENT_STATUS_CHECK_DELAY_MS = 30_000;
const PAYMENT_STATUS_CHECK_ATTEMPTS = 5;
const PAYMENT_STATUS_CHECK_BACKOFF_MS = 10_000;

export const PAYMENT_STATUS_CHECK_QUEUE_NAME = 'payment-status-check';
export const PAYMENT_STATUS_CHECK_JOB_NAME = 'payment-status-check';

export type PaymentStatusJob = {
  paymentId: string;
};

export function paymentStatusCheckJob(paymentId: string) {
  return {
    name: PAYMENT_STATUS_CHECK_JOB_NAME,
    data: { paymentId },
    options: {
      jobId: `payment-status-check-${paymentId}`,
      delay: PAYMENT_STATUS_CHECK_DELAY_MS,
      attempts: PAYMENT_STATUS_CHECK_ATTEMPTS,
      backoff: { type: 'exponential', delay: PAYMENT_STATUS_CHECK_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: { count: 500 },
    },
  };
}

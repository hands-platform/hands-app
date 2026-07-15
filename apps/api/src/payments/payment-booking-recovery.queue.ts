const PAYMENT_BOOKING_RECOVERY_ATTEMPTS = 3;
const PAYMENT_BOOKING_RECOVERY_BACKOFF_MS = 5_000;

export const PAYMENT_BOOKING_RECOVERY_QUEUE_NAME = 'payment-booking-recovery';
export const PAYMENT_BOOKING_RECOVERY_JOB_NAME = 'payment-booking-recovery';

export type PaymentBookingRecoveryJob = {
  bookingId: string;
  paymentId: string;
};

export function paymentBookingRecoveryJob(data: PaymentBookingRecoveryJob) {
  return {
    name: PAYMENT_BOOKING_RECOVERY_JOB_NAME,
    data,
    options: {
      jobId: `payment-booking-recovery-${data.bookingId}`,
      attempts: PAYMENT_BOOKING_RECOVERY_ATTEMPTS,
      backoff: { type: 'exponential', delay: PAYMENT_BOOKING_RECOVERY_BACKOFF_MS },
      removeOnComplete: true,
      removeOnFail: false,
    },
  };
}

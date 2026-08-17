export const BOOKING_TIMEOUT_QUEUE_NAME = 'booking-timeouts';
export const BOOKING_TIMEOUT_JOB_NAME = 'booking-timeout';

export type BookingTimeoutJob = {
  bookingId: string;
};

export function bookingTimeoutJob(bookingId: string, expiresAt: Date) {
  return {
    name: BOOKING_TIMEOUT_JOB_NAME,
    data: { bookingId },
    options: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5_000 },
      delay: Math.max(expiresAt.getTime() - Date.now(), 0),
      jobId: `${BOOKING_TIMEOUT_JOB_NAME}-${bookingId}`,
      removeOnComplete: true,
      removeOnFail: { count: 500 },
    },
  };
}

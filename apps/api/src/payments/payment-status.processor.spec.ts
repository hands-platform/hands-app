import { PaymentStatus } from '@prisma/client';
import { PaymentStatusProcessor } from './payment-status.processor';

describe('PaymentStatusProcessor', () => {
  it('queues one booking recovery after a verified gateway status result', async () => {
    const payments = {
      checkAndSyncStatus: vi.fn().mockResolvedValue({
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        status: PaymentStatus.PENDING,
        bookingRecoveryReady: true,
      }),
    };
    const recoveryQueue = { add: vi.fn() };
    const processor = new PaymentStatusProcessor(payments as never, recoveryQueue as never);

    await processor.process({ data: { paymentId: 'payment-1' } } as never);

    expect(recoveryQueue.add).toHaveBeenCalledWith(
      'payment-booking-recovery',
      { bookingId: 'booking-1', paymentId: 'payment-1' },
      {
        jobId: 'payment-booking-recovery-booking-1',
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: true,
        removeOnFail: { count: 500 },
      },
    );
  });

  it('does not queue recovery when gateway evidence is not ready', async () => {
    const payments = {
      checkAndSyncStatus: vi.fn().mockResolvedValue({
        paymentId: 'payment-1',
        bookingId: 'booking-1',
        status: PaymentStatus.FAILED,
        bookingRecoveryReady: false,
      }),
    };
    const recoveryQueue = { add: vi.fn() };
    const processor = new PaymentStatusProcessor(payments as never, recoveryQueue as never);

    await processor.process({ data: { paymentId: 'payment-1' } } as never);

    expect(recoveryQueue.add).not.toHaveBeenCalled();
  });
});

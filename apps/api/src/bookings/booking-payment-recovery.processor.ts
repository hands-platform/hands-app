import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  PAYMENT_BOOKING_RECOVERY_QUEUE_NAME,
  type PaymentBookingRecoveryJob,
} from '../payments/payment-booking-recovery.queue';
import { BookingsService } from './bookings.service';

@Processor(PAYMENT_BOOKING_RECOVERY_QUEUE_NAME)
export class BookingPaymentRecoveryProcessor extends WorkerHost {
  constructor(private readonly bookings: BookingsService) {
    super();
  }

  process(job: Job<PaymentBookingRecoveryJob>) {
    return this.bookings.recoverCreatedBookingAfterPayment(job.data.bookingId, job.data.paymentId);
  }
}

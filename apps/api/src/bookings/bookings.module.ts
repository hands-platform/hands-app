import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EarningsModule } from '../earnings/earnings.module';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { PAYMENT_BOOKING_RECOVERY_QUEUE_NAME } from '../payments/payment-booking-recovery.queue';
import { BookingPaymentRecoveryProcessor } from './booking-payment-recovery.processor';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    MatchingModule,
    PaymentsModule,
    NotificationsModule,
    EarningsModule,
    BullModule.registerQueue({ name: PAYMENT_BOOKING_RECOVERY_QUEUE_NAME }),
  ],
  controllers: [BookingsController],
  providers: [BookingsService, BookingPaymentRecoveryProcessor],
  exports: [BookingsService],
})
export class BookingsModule {}

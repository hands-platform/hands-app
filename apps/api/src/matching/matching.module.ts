import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { BOOKING_TIMEOUT_QUEUE_NAME } from './booking-timeout.queue';
import { MatchingGateway } from './matching.gateway';
import { BookingTimeoutProcessor } from './matching.processor';
import { MatchingService } from './matching.service';

@Module({
  imports: [BullModule.registerQueue({ name: BOOKING_TIMEOUT_QUEUE_NAME }), PaymentsModule],
  providers: [MatchingService, MatchingGateway, BookingTimeoutProcessor],
  exports: [MatchingService, MatchingGateway],
})
export class MatchingModule {}

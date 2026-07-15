import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EarningsModule } from '../earnings/earnings.module';
import { BOOKING_TIMEOUT_QUEUE_NAME } from '../matching/booking-timeout.queue';
import { NotificationsModule } from '../notifications/notifications.module';
import { NOTIFICATION_SEND_QUEUE_NAME } from '../notifications/notification-send.queue';
import { PAYMENT_REFUND_STATUS_QUEUE_NAME } from '../payments/payment-refund-status.queue';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME } from '../payments/payment-status.queue';
import { ReferralsModule } from '../referrals/referrals.module';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminSystemController } from './admin-system.controller';
import { BankStatementEscalationProcessor } from './bank-statement-escalation.processor';
import { BANK_STATEMENT_ESCALATION_QUEUE_NAME } from './bank-statement-escalation.queue';
import { BankStatementEscalationScheduler } from './bank-statement-escalation.scheduler';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: BANK_STATEMENT_ESCALATION_QUEUE_NAME },
      { name: BOOKING_TIMEOUT_QUEUE_NAME },
      { name: NOTIFICATION_SEND_QUEUE_NAME },
      { name: PAYMENT_REFUND_STATUS_QUEUE_NAME },
      { name: PAYMENT_STATUS_CHECK_QUEUE_NAME },
    ),
    EarningsModule,
    NotificationsModule,
    ReferralsModule,
  ],
  controllers: [AdminController, AdminSystemController],
  providers: [
    AdminBackgroundJobsService,
    AdminService,
    BankStatementEscalationProcessor,
    BankStatementEscalationScheduler,
  ],
  exports: [AdminService],
})
export class AdminModule {}

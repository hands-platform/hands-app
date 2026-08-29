import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { EarningsModule } from '../earnings/earnings.module';
import { FilesModule } from '../files/files.module';
import { BOOKING_TIMEOUT_QUEUE_NAME } from '../matching/booking-timeout.queue';
import { MatchingModule } from '../matching/matching.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ADMIN_PUSH_CAMPAIGN_QUEUE_NAME } from '../notifications/admin-push-campaign.queue';
import { NOTIFICATION_SEND_QUEUE_NAME } from '../notifications/notification-send.queue';
import { PAYMENT_BOOKING_RECOVERY_QUEUE_NAME } from '../payments/payment-booking-recovery.queue';
import { PAYMENT_REFUND_STATUS_QUEUE_NAME } from '../payments/payment-refund-status.queue';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME } from '../payments/payment-status.queue';
import { PaymentsModule } from '../payments/payments.module';
import { ProvidersModule } from '../providers/providers.module';
import { TAX_POLICY_ACTIVATION_QUEUE_NAME } from '../provider-onboarding/tax-policy-activation.queue';
import { ReferralsModule } from '../referrals/referrals.module';
import { SiteContentModule } from '../site-content/site-content.module';
import { AdminBackgroundJobsService } from './admin-background-jobs.service';
import { AdminNotificationDeliveryIncidentSyncService } from './admin-notification-delivery-incident-sync.service';
import { AdminController } from './admin.controller';
import { AdminOperatorCategoryGuard } from './admin-operator-category.guard';
import { AdminService } from './admin.service';
import { AdminSystemController } from './admin-system.controller';
import { BankStatementEscalationProcessor } from './bank-statement-escalation.processor';
import { BANK_STATEMENT_ESCALATION_QUEUE_NAME } from './bank-statement-escalation.queue';
import { BankStatementEscalationScheduler } from './bank-statement-escalation.scheduler';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: ADMIN_PUSH_CAMPAIGN_QUEUE_NAME },
      { name: BANK_STATEMENT_ESCALATION_QUEUE_NAME },
      { name: BOOKING_TIMEOUT_QUEUE_NAME },
      { name: NOTIFICATION_SEND_QUEUE_NAME },
      { name: PAYMENT_BOOKING_RECOVERY_QUEUE_NAME },
      { name: PAYMENT_REFUND_STATUS_QUEUE_NAME },
      { name: PAYMENT_STATUS_CHECK_QUEUE_NAME },
      { name: TAX_POLICY_ACTIVATION_QUEUE_NAME },
    ),
    EarningsModule,
    FilesModule,
    NotificationsModule,
    forwardRef(() => MatchingModule),
    forwardRef(() => PaymentsModule),
    ProvidersModule,
    ReferralsModule,
    SiteContentModule,
  ],
  controllers: [AdminController, AdminSystemController],
  providers: [
    AdminBackgroundJobsService,
    AdminNotificationDeliveryIncidentSyncService,
    AdminOperatorCategoryGuard,
    AdminService,
    BankStatementEscalationProcessor,
    BankStatementEscalationScheduler,
  ],
  exports: [AdminOperatorCategoryGuard, AdminService],
})
export class AdminModule {}

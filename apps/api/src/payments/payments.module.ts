import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { EarningsModule } from '../earnings/earnings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CashPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME } from './payment-status.queue';
import { PaymentStatusProcessor } from './payment-status.processor';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    AdminModule,
    EarningsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: PAYMENT_STATUS_CHECK_QUEUE_NAME }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, MomoPaymentAdapter, VnpayPaymentAdapter, CashPaymentAdapter, PaymentStatusProcessor],
  exports: [PaymentsService],
})
export class PaymentsModule {}

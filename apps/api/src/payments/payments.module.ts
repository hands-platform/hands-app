import { BullModule } from '@nestjs/bullmq';
import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { EarningsModule } from '../earnings/earnings.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CardPaymentAdapter, CashPaymentAdapter, MomoPaymentAdapter, VnpayPaymentAdapter } from './adapters';
import { MomoGatewayClient } from './momo-gateway.client';
import { PAYMENT_BOOKING_RECOVERY_QUEUE_NAME } from './payment-booking-recovery.queue';
import { PAYMENT_REFUND_STATUS_QUEUE_NAME } from './payment-refund-status.queue';
import { PaymentRefundStatusProcessor } from './payment-refund-status.processor';
import { PAYMENT_STATUS_CHECK_QUEUE_NAME } from './payment-status.queue';
import { PaymentStatusProcessor } from './payment-status.processor';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { VnpayGatewayClient } from './vnpay-gateway.client';

@Module({
  imports: [
    forwardRef(() => AdminModule),
    EarningsModule,
    NotificationsModule,
    BullModule.registerQueue({ name: PAYMENT_STATUS_CHECK_QUEUE_NAME }),
    BullModule.registerQueue({ name: PAYMENT_BOOKING_RECOVERY_QUEUE_NAME }),
    BullModule.registerQueue({ name: PAYMENT_REFUND_STATUS_QUEUE_NAME }),
  ],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    MomoGatewayClient,
    VnpayGatewayClient,
    MomoPaymentAdapter,
    VnpayPaymentAdapter,
    CardPaymentAdapter,
    CashPaymentAdapter,
    PaymentStatusProcessor,
    PaymentRefundStatusProcessor,
  ],
  exports: [PaymentsService, MomoGatewayClient, VnpayGatewayClient],
})
export class PaymentsModule {}

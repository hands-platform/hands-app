import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NOTIFICATION_SEND_QUEUE_NAME } from './notification-send.queue';
import { NotificationRetryProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { PushDeliveryService } from './push-delivery.service';

@Module({
  imports: [BullModule.registerQueue({ name: NOTIFICATION_SEND_QUEUE_NAME })],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationRetryProcessor, PushDeliveryService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

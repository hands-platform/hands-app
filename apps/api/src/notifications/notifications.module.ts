import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { AdminPushCampaignProcessor } from './admin-push-campaign.processor';
import { ADMIN_PUSH_CAMPAIGN_QUEUE_NAME } from './admin-push-campaign.queue';
import { NOTIFICATION_SEND_QUEUE_NAME } from './notification-send.queue';
import { NotificationRetryProcessor } from './notifications.processor';
import { NotificationsService } from './notifications.service';
import { PushDeliveryService } from './push-delivery.service';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: ADMIN_PUSH_CAMPAIGN_QUEUE_NAME },
      { name: NOTIFICATION_SEND_QUEUE_NAME },
    ),
  ],
  controllers: [NotificationsController],
  providers: [
    AdminPushCampaignProcessor,
    NotificationsService,
    NotificationRetryProcessor,
    PushDeliveryService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}

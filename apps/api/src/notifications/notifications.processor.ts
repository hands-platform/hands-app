import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  isFcmPartnerAlertChannel,
  NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
} from '../matching/matching.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_SEND_QUEUE_NAME,
  type NotificationSendJob,
} from './notification-send.queue';
import {
  isPartnerAlert,
  toPushData,
} from './notification-push-payload';
import {
  notificationDeliveryCreateInput,
  notificationDeliveryJobResult,
} from './notification-delivery-record';
import { PushDeliveryService } from './push-delivery.service';

export { isPartnerAlert, toPushData } from './notification-push-payload';

@Processor(NOTIFICATION_SEND_QUEUE_NAME)
export class NotificationRetryProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDelivery: PushDeliveryService,
  ) {
    super();
  }

  async process(job: Job<NotificationSendJob>) {
    const notification = await this.prisma.notification.findUnique({
      where: { id: job.data.notificationId },
      include: { user: { include: { pushDevices: { where: { enabled: true } } } } },
    });

    if (!notification) {
      return { skipped: true };
    }

    const devices = notification.user.pushDevices;
    if (devices.length === 0) {
      return { skipped: true, reason: 'NO_ENABLED_DEVICES', notificationId: notification.id };
    }

    const results = [];
    const data = toPushData(notification.data);
    const providerOverride = await this.resolveProviderOverride(notification.type);

    for (const device of devices) {
      const result = await this.pushDelivery.send({
        token: device.token,
        title: notification.title,
        body: notification.body,
        data,
        providerOverride,
      });

      await this.prisma.$transaction(async (tx) => {
        await tx.notificationDelivery.create(
          notificationDeliveryCreateInput({
            notificationId: notification.id,
            pushDeviceId: device.id,
            pushToken: device.token,
            result,
          }),
        );

        if (result.disableDevice) {
          await tx.pushDevice.update({
            where: { id: device.id },
            data: { enabled: false, lastSeenAt: new Date() },
          });
        }
      });

      results.push(notificationDeliveryJobResult({ deviceId: device.id, result }));
    }

    return {
      notificationId: notification.id,
      userId: notification.userId,
      results,
    };
  }

  private async resolveProviderOverride(notificationType: string) {
    if (!isPartnerAlert(notificationType)) {
      return undefined;
    }

    const setting = await this.prisma.operationalPolicySetting.findUnique({
      where: { key: NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY },
      select: { value: true },
    });

    return isFcmPartnerAlertChannel(setting?.value) ? 'fcm' : 'in_app_only';
  }
}

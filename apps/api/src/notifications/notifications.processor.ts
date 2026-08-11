import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import {
  isFcmPartnerAlertChannel,
  NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
} from '../matching/matching.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_SEND_QUEUE_NAME,
  NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,
  type NotificationSendJob,
} from './notification-send.queue';
import {
  isPartnerAlert,
  notificationPushData,
} from './notification-push-payload';
import {
  notificationDeliveryCreateInput,
  notificationDeliveryJobResult,
} from './notification-delivery-record';
import {
  notificationTargetRole,
  pushDeviceMatchesTargetRole,
} from './notification-target-role';
import { PushDeliveryService, type PushSendResult } from './push-delivery.service';
import type { PushProvider } from './push-provider';

export const notificationSendPushDeviceOrder = [
  { updatedAt: 'desc' },
  { createdAt: 'desc' },
] satisfies Prisma.PushDeviceOrderByWithRelationInput[];
const notificationSendInclude = Prisma.validator<Prisma.NotificationInclude>()({
  deliveries: {
    where: { status: 'SENT' },
    select: { pushDeviceId: true },
  },
  user: {
    include: {
      pushDevices: {
        where: { enabled: true },
        orderBy: notificationSendPushDeviceOrder,
        take: NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,
      },
    },
  },
});

type NotificationForSend = Prisma.NotificationGetPayload<{ include: typeof notificationSendInclude }>;
type EnabledPushDevice = NotificationForSend['user']['pushDevices'][number];

@Processor(NOTIFICATION_SEND_QUEUE_NAME)
export class NotificationRetryProcessor extends WorkerHost {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pushDelivery: PushDeliveryService,
  ) {
    super();
  }

  async process(job: Job<NotificationSendJob>) {
    const notification = await this.findNotificationForSend(job.data.notificationId);

    if (!notification) {
      return { skipped: true };
    }

    const targetRole = notificationTargetRole(notification);
    const targetDevices = notification.user.pushDevices
      .filter((device) => pushDeviceMatchesTargetRole(device, targetRole))
      .slice(0, NOTIFICATION_SEND_PUSH_DEVICE_LIMIT);
    if (targetDevices.length === 0) {
      return {
        skipped: true,
        reason: targetRole ? 'NO_ENABLED_TARGET_ROLE_DEVICES' : 'NO_ENABLED_DEVICES',
        notificationId: notification.id,
        ...(targetRole ? { targetRole } : {}),
      };
    }

    const deliveredDeviceIds = new Set(
      (notification.deliveries ?? []).map((delivery) => delivery.pushDeviceId),
    );
    const devices = targetDevices.filter((device) => !deliveredDeviceIds.has(device.id));
    const skippedDeliveredDeviceCount = targetDevices.length - devices.length;
    if (devices.length === 0) {
      return {
        skipped: true,
        reason: 'ALREADY_DELIVERED',
        notificationId: notification.id,
        skippedDeliveredDeviceCount,
      };
    }

    const results = [];
    const data = notificationPushData(notification);
    const providerOverride = await this.resolveProviderOverride(notification.type);

    for (const device of devices) {
      results.push(await this.sendToDevice(notification, device, data, providerOverride));
    }

    return {
      notificationId: notification.id,
      userId: notification.userId,
      results,
      ...(skippedDeliveredDeviceCount > 0 ? { skippedDeliveredDeviceCount } : {}),
    };
  }

  private findNotificationForSend(notificationId: string) {
    return this.prisma.notification.findUnique({
      where: { id: notificationId },
      include: notificationSendInclude,
    });
  }

  private async sendToDevice(
    notification: NotificationForSend,
    device: EnabledPushDevice,
    data: ReturnType<typeof notificationPushData>,
    providerOverride: PushProvider | undefined,
  ) {
    const result = await this.pushDelivery.send({
      token: device.token,
      title: notification.title,
      body: notification.body,
      data,
      providerOverride,
    });

    await this.recordDeliveryResult(notification.id, device, result);

    return notificationDeliveryJobResult({ deviceId: device.id, result });
  }

  private async recordDeliveryResult(
    notificationId: string,
    device: EnabledPushDevice,
    result: PushSendResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.notificationDelivery.create(
        notificationDeliveryCreateInput({
          notificationId,
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
  }

  private async resolveProviderOverride(notificationType: string): Promise<PushProvider | undefined> {
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

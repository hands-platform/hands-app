import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import {
  NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
  PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS,
  PARTNER_ALERT_LEGACY_ONESIGNAL_FOR_ALL_BOOKINGS,
} from '../matching/matching.policy';
import { PrismaService } from '../prisma/prisma.service';
import { PushDeliveryService } from './push-delivery.service';

type NotificationSendJob = {
  notificationId: string;
};

const PARTNER_ALERT_TYPES = new Set([
  'booking.requested',
  'booking.backup_available',
  'booking.matched',
  'provider.payout_setup_required',
  'provider.payout_batch.updated',
]);
const PUSH_DATA_KEYS = new Set([
  'bookingId',
  'chatRoomId',
  'providerProfileId',
  'customerProfileId',
  'notificationId',
  'paymentId',
  'earningId',
  'payoutBatchId',
  'fileId',
  'sanctionId',
]);

@Processor('notification-retry')
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
        await tx.notificationDelivery.create({
          data: {
            notificationId: notification.id,
            pushDeviceId: device.id,
            provider: result.provider,
            status: result.status,
            response: toJson(result.response),
          },
        });

        if (result.disableDevice) {
          await tx.pushDevice.update({
            where: { id: device.id },
            data: { enabled: false },
          });
        }
      });

      results.push({
        deviceId: device.id,
        status: result.status,
        provider: result.provider,
        disableDevice: result.disableDevice,
        failureCode: result.failureCode,
      });
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

    return setting?.value === PARTNER_ALERT_FCM_FOR_ALL_BOOKINGS ||
      setting?.value === PARTNER_ALERT_LEGACY_ONESIGNAL_FOR_ALL_BOOKINGS
      ? 'fcm'
      : 'in_app_only';
  }
}

export function isPartnerAlert(notificationType: string) {
  return PARTNER_ALERT_TYPES.has(notificationType);
}

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function toPushData(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, entry]) => PUSH_DATA_KEYS.has(key) && isPushDataScalar(entry),
  );
  if (entries.length === 0) {
    return undefined;
  }

  return Object.fromEntries(entries.map(([key, entry]) => [key, String(entry)]));
}

function isPushDataScalar(value: unknown) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

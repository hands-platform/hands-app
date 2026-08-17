import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import {
  isFcmPartnerAlertChannel,
  NOTIFICATION_PARTNER_ALERT_CHANNEL_KEY,
} from '../matching/matching.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_DELIVERY_CLAIM_STALE_MS,
  NOTIFICATION_DELIVERY_UNKNOWN_CODE,
  NOTIFICATION_SEND_QUEUE_NAME,
  NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,
  type NotificationSendJob,
} from './notification-send.queue';
import { notificationDeliveryFailureCode } from './notification-delivery-failure';
import {
  isPartnerAlert,
  notificationPushData,
} from './notification-push-payload';
import {
  notificationDeliveryJobResult,
  notificationDeliveryResultUpdate,
} from './notification-delivery-record';
import {
  isRoleNeutralNotificationType,
  notificationTargetRole,
  pushDeviceMatchesTargetRole,
} from './notification-target-role';
import { PushDeliveryService, type PushSendResult } from './push-delivery.service';
import type { PushProvider } from './push-provider';
import { notificationRetryFailureClass } from './notification-retry-decision';

export const notificationSendPushDeviceOrder = [
  { updatedAt: 'desc' },
  { createdAt: 'desc' },
] satisfies Prisma.PushDeviceOrderByWithRelationInput[];
const notificationSendInclude = Prisma.validator<Prisma.NotificationInclude>()({
  deliveries: {
    where: { status: 'SENT' },
    select: { pushDeviceId: true },
  },
});

type NotificationForSend = Prisma.NotificationGetPayload<{ include: typeof notificationSendInclude }>;
type EnabledPushDevice = Prisma.PushDeviceGetPayload<Record<string, never>>;

type AdminPushDeliveryStatus = 'PROCESSING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED';

export function adminPushDeliveryState(input: {
  eligibleDeviceCount: number;
  deliveredDeviceCount: number;
  failedDeviceCount: number;
  skippedDeviceCount: number;
}): {
  pendingDeviceCount: number;
  status: AdminPushDeliveryStatus;
} {
  const pendingDeviceCount = Math.max(
    0,
    input.eligibleDeviceCount -
      input.deliveredDeviceCount -
      input.failedDeviceCount -
      input.skippedDeviceCount,
  );
  const status =
    pendingDeviceCount > 0
      ? 'PROCESSING'
      : input.deliveredDeviceCount > 0 &&
          input.failedDeviceCount + input.skippedDeviceCount > 0
        ? 'PARTIAL_FAILED'
        : input.deliveredDeviceCount > 0
          ? 'COMPLETED'
          : 'FAILED';

  return { pendingDeviceCount, status };
}

export function adminPushLatestDeliveryCounts(
  deliveries: Array<{ pushDeviceId: string; status: string }>,
) {
  const latestByDevice = new Map<string, { pushDeviceId: string; status: string }>();
  for (const delivery of deliveries) {
    if (!latestByDevice.has(delivery.pushDeviceId)) {
      latestByDevice.set(delivery.pushDeviceId, delivery);
    }
  }
  const latestDeliveries = Array.from(latestByDevice.values());

  return {
    deliveredDeviceCount: latestDeliveries.filter((delivery) => delivery.status === 'SENT').length,
    failedDeviceCount: latestDeliveries.filter((delivery) => delivery.status === 'FAILED').length,
    recordedSkippedDeviceCount: latestDeliveries.filter(
      (delivery) => delivery.status === 'SKIPPED',
    ).length,
  };
}

@Processor({ name: NOTIFICATION_SEND_QUEUE_NAME, configKey: 'worker' })
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
    const roleNeutral = isRoleNeutralNotificationType(notification.type);
    if (!targetRole && !roleNeutral) {
      return {
        skipped: true,
        reason: 'MISSING_TARGET_ROLE',
        notificationId: notification.id,
      };
    }
    const locale = notificationLocale(notification.data);
    const campaignDeviceIds = await this.campaignDeviceIds(notification);
    const targetDevices = await this.prisma.pushDevice.findMany({
      where: {
        enabled: true,
        userId: notification.userId,
        ...(targetRole ? { role: targetRole } : {}),
        ...(locale
          ? { locale: { startsWith: locale, mode: Prisma.QueryMode.insensitive } }
          : {}),
        ...(campaignDeviceIds ? { id: { in: campaignDeviceIds } } : {}),
      },
      orderBy: notificationSendPushDeviceOrder,
      take: NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,
    });
    if (targetDevices.length === 0) {
      await this.updateCampaignEvidence(notification, 0);
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
    const devices = targetDevices.filter(
      (device) =>
        (roleNeutral || pushDeviceMatchesTargetRole(device, targetRole)) &&
        !deliveredDeviceIds.has(device.id),
    );
    const skippedDeliveredDeviceCount = targetDevices.length - devices.length;
    if (devices.length === 0) {
      await this.updateCampaignEvidence(notification, targetDevices.length);
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

    await this.updateCampaignEvidence(notification, targetDevices.length);

    if (
      results.some(
        (result) =>
          result.status === 'FAILED' &&
          notificationRetryFailureClass(result.failureCode ?? null) === 'transient',
      )
    ) {
      throw new Error(`Notification ${notification.id} has a retryable push delivery failure`);
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

  private async campaignDeviceIds(notification: NotificationForSend) {
    const campaignId = notificationDataString(notification.data, 'campaignId');
    if (!campaignId) return undefined;
    const recipient = await this.prisma.adminPushCampaignRecipient.findUnique({
      where: { campaignId_userId: { campaignId, userId: notification.userId } },
      select: { deviceIds: true },
    });
    return jsonStringArray(recipient?.deviceIds);
  }

  private async updateCampaignEvidence(notification: NotificationForSend, availableDeviceCount: number) {
    const campaignId = notificationDataString(notification.data, 'campaignId');
    if (!campaignId) return;
    const recipient = await this.prisma.adminPushCampaignRecipient.findUnique({
      where: { campaignId_userId: { campaignId, userId: notification.userId } },
      select: { eligibleDeviceCount: true },
    });
    if (!recipient) return;
    const deliveries = await this.prisma.notificationDelivery.findMany({
      where: { notificationId: notification.id },
      orderBy: { attemptedAt: 'desc' },
      select: { pushDeviceId: true, status: true },
    });
    const { deliveredDeviceCount, failedDeviceCount, recordedSkippedDeviceCount } =
      adminPushLatestDeliveryCounts(deliveries);
    const unavailableDeviceCount = Math.max(
      0,
      recipient.eligibleDeviceCount - availableDeviceCount,
    );
    const skippedDeviceCount = recordedSkippedDeviceCount + unavailableDeviceCount;
    const { pendingDeviceCount, status } = adminPushDeliveryState({
      eligibleDeviceCount: recipient.eligibleDeviceCount,
      deliveredDeviceCount,
      failedDeviceCount,
      skippedDeviceCount,
    });
    await this.prisma.adminPushCampaignRecipient.update({
      where: { campaignId_userId: { campaignId, userId: notification.userId } },
      data: {
        deliveredDeviceCount,
        failedDeviceCount,
        processedAt: pendingDeviceCount === 0 ? new Date() : undefined,
        skippedDeviceCount,
        status,
      },
    });
    await this.refreshCampaignAggregate(campaignId);
  }

  private async refreshCampaignAggregate(campaignId: string) {
    const campaign = await this.prisma.adminPushCampaign.findUnique({
      where: { id: campaignId },
      include: { recipients: true },
    });
    if (!campaign) return;
    const deliveredDeviceCount = campaign.recipients.reduce(
      (sum, recipient) => sum + recipient.deliveredDeviceCount,
      0,
    );
    const failedDeviceCount = campaign.recipients.reduce(
      (sum, recipient) => sum + recipient.failedDeviceCount,
      0,
    );
    const skippedDeviceCount = campaign.recipients.reduce(
      (sum, recipient) => sum + recipient.skippedDeviceCount,
      0,
    );
    const { pendingDeviceCount, status } = adminPushDeliveryState({
      eligibleDeviceCount: campaign.eligibleDeviceCount,
      deliveredDeviceCount,
      failedDeviceCount,
      skippedDeviceCount,
    });
    const terminal = status !== 'PROCESSING';
    const completedAt = terminal ? new Date() : undefined;
    const shouldAuditTerminal = terminal && (campaign.status !== status || !campaign.completedAt);
    await this.prisma.$transaction([
      this.prisma.adminPushCampaign.update({
        where: { id: campaignId },
        data: {
          completedAt: terminal ? completedAt : undefined,
          deliveredDeviceCount,
          failedAt: status === 'FAILED' ? completedAt : undefined,
          failedDeviceCount,
          pendingDeviceCount,
          sentAt: deliveredDeviceCount > 0 && terminal ? completedAt : undefined,
          skippedDeviceCount,
          status,
        },
      }),
      ...(shouldAuditTerminal
        ? [
            this.prisma.adminAuditLog.create({
              data: {
                action: `admin_push_campaign.${status.toLowerCase()}`,
                actorKey: 'notification-worker',
                actorType: 'SYSTEM',
                area: 'SYSTEM',
                metadata: {
                  campaignId,
                  deliveredDeviceCount,
                  failedDeviceCount,
                  pendingDeviceCount,
                  skippedDeviceCount,
                  source: 'notification_worker',
                },
                objectId: campaignId,
                objectType: 'admin_push_campaign',
                outcome: status === 'COMPLETED' ? 'SUCCEEDED' : 'FAILED',
                severity: status === 'COMPLETED' ? 'INFO' : 'REVIEW',
                source: 'notification_worker',
                target: `admin_push_campaign:${campaignId}`,
              },
            }),
          ]
        : []),
    ]);
  }

  private async sendToDevice(
    notification: NotificationForSend,
    device: EnabledPushDevice,
    data: ReturnType<typeof notificationPushData>,
    providerOverride: PushProvider | undefined,
  ) {
    const claim = await this.claimDeliveryAttempt(notification.id, device);
    if (claim.state !== 'CLAIMED') {
      return {
        deviceId: device.id,
        provider: claim.provider,
        status: claim.status,
        disableDevice: false,
        failureCode: claim.failureCode,
      };
    }
    const result = await this.pushDelivery.send({
      token: device.token,
      title: notification.title,
      body: notification.body,
      data,
      providerOverride,
    });

    await this.recordDeliveryResult(claim.deliveryId, device, result);

    return notificationDeliveryJobResult({ deviceId: device.id, result });
  }

  private async recordDeliveryResult(
    deliveryId: string,
    device: EnabledPushDevice,
    result: PushSendResult,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.notificationDelivery.update({
        where: { id: deliveryId },
        data: notificationDeliveryResultUpdate({ pushToken: device.token, result }),
      });

      if (result.disableDevice) {
        await tx.pushDevice.update({
          where: { id: device.id },
          data: { enabled: false, lastSeenAt: new Date() },
        });
      }
    });
  }

  private claimDeliveryAttempt(notificationId: string, device: EnabledPushDevice) {
    const now = new Date();
    const staleBefore = new Date(now.getTime() - NOTIFICATION_DELIVERY_CLAIM_STALE_MS);
    const lockKey = `notification-delivery:${notificationId}:${device.id}`;

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`,
      );
      const latest = await tx.notificationDelivery.findFirst({
        where: { notificationId, pushDeviceId: device.id },
        orderBy: [{ attemptedAt: 'desc' }, { id: 'desc' }],
        select: { attemptedAt: true, id: true, provider: true, response: true, status: true },
      });
      if (latest?.status === 'SENT') {
        return {
          state: 'SKIPPED' as const,
          provider: latest.provider,
          status: 'SENT' as const,
        };
      }
      if (
        latest?.status === 'FAILED' &&
        notificationDeliveryFailureCode(latest.response) === NOTIFICATION_DELIVERY_UNKNOWN_CODE
      ) {
        return {
          state: 'SKIPPED' as const,
          provider: latest.provider,
          status: 'FAILED' as const,
          failureCode: NOTIFICATION_DELIVERY_UNKNOWN_CODE,
        };
      }
      if (latest?.status === 'PROCESSING' && latest.attemptedAt > staleBefore) {
        return {
          state: 'SKIPPED' as const,
          provider: latest.provider,
          status: 'PROCESSING' as const,
        };
      }
      if (latest?.status === 'PROCESSING') {
        await tx.notificationDelivery.update({
          where: { id: latest.id },
          data: {
            status: 'FAILED',
            response: {
              failureCode: NOTIFICATION_DELIVERY_UNKNOWN_CODE,
              reason: 'The worker stopped after delivery started, so the provider outcome is unknown.',
            },
          },
        });
        return {
          state: 'SKIPPED' as const,
          provider: latest.provider,
          status: 'FAILED' as const,
          failureCode: NOTIFICATION_DELIVERY_UNKNOWN_CODE,
        };
      }

      const claim = await tx.notificationDelivery.create({
        data: {
          notificationId,
          pushDeviceId: device.id,
          provider: 'PENDING',
          status: 'PROCESSING',
          response: { claimedAt: now.toISOString() },
        },
        select: { id: true },
      });
      return { state: 'CLAIMED' as const, deliveryId: claim.id };
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

function notificationLocale(data: unknown) {
  const locale = notificationDataString(data, 'locale')?.toLowerCase();
  return locale && ['en', 'vi', 'ko', 'ja', 'zh'].includes(locale) ? locale : undefined;
}

function notificationDataString(data: unknown, key: string) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return undefined;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function jsonStringArray(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  return strings.length > 0 ? strings : undefined;
}

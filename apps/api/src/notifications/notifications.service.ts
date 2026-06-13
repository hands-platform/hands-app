import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { pushDeviceDisableInput, pushDeviceRegistrationInput } from './notification-device-token';
import { NOTIFICATION_SEND_QUEUE_NAME, notificationSendJob } from './notification-send.queue';
import { toJson } from './notification-push-payload';
import { notificationDataWithTargetRole, type NotificationTargetRole } from './notification-target-role';

type CreateNotificationInput = {
  userId: string;
  targetRole?: NotificationTargetRole;
  type: string;
  title: string;
  body: string;
  data?: unknown;
};

type RetryNotificationLatestDelivery = {
  id: string;
  provider: string;
  status: string;
  attemptedAt: string;
  failureCode: string | null;
  pushDeviceId: string | null;
  pushDeviceEnabled: boolean | null;
  pushDevicePlatform: string | null;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_SEND_QUEUE_NAME) private readonly notificationQueue: Queue,
  ) {}

  async create(input: CreateNotificationInput) {
    const data = notificationDataWithTargetRole(input.data, input.targetRole);
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: data === undefined ? undefined : toJson(data),
      },
    });

    await this.enqueueNotificationSend(notification.id);

    return notification;
  }

  async retry(notificationId: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      select: {
        id: true,
        deliveries: {
          orderBy: { attemptedAt: 'desc' },
          take: 1,
          select: {
            id: true,
            provider: true,
            status: true,
            attemptedAt: true,
            response: true,
            pushDeviceId: true,
            pushDevice: { select: { enabled: true, platform: true } },
          },
        },
      },
    });
    const latestDelivery = summarizeRetryLatestDelivery(notification.deliveries[0]);
    await this.enqueueNotificationSend(notification.id);
    return { ok: true, notificationId: notification.id, latestDelivery };
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  markRead(userId: string, notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  registerDeviceToken(user: AuthenticatedUser, input: { token: string; platform: string }) {
    return this.prisma.pushDevice.upsert(pushDeviceRegistrationInput(user, input));
  }

  async disableDeviceToken(user: AuthenticatedUser, input: { token: string }) {
    const result = await this.prisma.pushDevice.updateMany(pushDeviceDisableInput(user.id, input.token));

    return { ok: result.count > 0, disabled: result.count };
  }

  private async enqueueNotificationSend(notificationId: string) {
    const job = notificationSendJob(notificationId);
    await this.notificationQueue.add(job.name, job.data, job.options);
  }
}

function summarizeRetryLatestDelivery(
  delivery:
    | {
        id: string;
        provider: string;
        status: string;
        attemptedAt: Date;
        response: unknown;
        pushDeviceId: string | null;
        pushDevice: { enabled: boolean; platform: string } | null;
      }
    | undefined,
): RetryNotificationLatestDelivery | null {
  if (!delivery) {
    return null;
  }

  return {
    id: delivery.id,
    provider: delivery.provider,
    status: delivery.status,
    attemptedAt: delivery.attemptedAt.toISOString(),
    failureCode: notificationDeliveryFailureCode(delivery.response),
    pushDeviceId: delivery.pushDeviceId,
    pushDeviceEnabled: delivery.pushDevice?.enabled ?? null,
    pushDevicePlatform: delivery.pushDevice?.platform ?? null,
  };
}

function notificationDeliveryFailureCode(response: unknown) {
  const body = readRecord(readRecord(response)?.body);
  const error = readRecord(body?.error);
  const details = Array.isArray(error?.details) ? error.details : [];
  const firstDetail = readRecord(details[0]);
  return (
    readString(readRecord(response)?.failureCode) ??
    readString(firstDetail?.errorCode) ??
    readString(body?.code) ??
    readString(error?.code)
  );
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { notificationDeliveryFailureCode } from './notification-delivery-failure';
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

type RetryNotificationJobSummary = {
  queueName: string;
  jobName: string;
  attempts: number;
  backoffMs: number | null;
  queuedJobId: string | null;
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
    const retryJob = await this.enqueueNotificationSend(notification.id);
    return { ok: true, notificationId: notification.id, latestDelivery, retryJob };
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

  private async enqueueNotificationSend(notificationId: string): Promise<RetryNotificationJobSummary> {
    const job = notificationSendJob(notificationId);
    const queuedJob = await this.notificationQueue.add(job.name, job.data, job.options);

    return {
      queueName: NOTIFICATION_SEND_QUEUE_NAME,
      jobName: job.name,
      attempts: job.options.attempts,
      backoffMs: retryJobBackoffMs(job.options.backoff),
      queuedJobId: queuedJob?.id ? String(queuedJob.id) : null,
    };
  }
}

function retryJobBackoffMs(backoff: ReturnType<typeof notificationSendJob>['options']['backoff']) {
  return typeof backoff === 'object' && backoff ? backoff.delay : null;
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

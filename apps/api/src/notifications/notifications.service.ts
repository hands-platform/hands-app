import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { notificationDeliveryFailureCode } from './notification-delivery-failure';
import {
  type RegisterDeviceTokenInput,
  pushDeviceDisableInput,
  pushDeviceRegistrationInput,
} from './notification-device-token';
import { NOTIFICATION_SEND_QUEUE_NAME, notificationSendJob } from './notification-send.queue';
import { toJson } from './notification-push-payload';
import type {
  NotificationRetryAuditJobSummary,
  NotificationRetryAuditLatestDelivery,
  NotificationRetryAuditResult,
} from './notification-retry-audit';
import {
  type NotificationTemplateLocale,
  isNotificationTemplateLocale,
} from './notification-template-catalog';
import { notificationDataWithTargetRole, type NotificationTargetRole } from './notification-target-role';

type CreateNotificationInput = {
  userId: string;
  targetRole?: NotificationTargetRole;
  type: string;
  locale?: string;
  resolveTemplate?: boolean;
  title: string;
  body: string;
  data?: unknown;
};

type RetryNotificationResult = NotificationRetryAuditResult & {
  readonly ok: true;
  readonly notificationId: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_SEND_QUEUE_NAME) private readonly notificationQueue: Queue,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.persist(input);

    await this.enqueueNotificationSend(notification.id);

    return notification;
  }

  createInApp(input: CreateNotificationInput) {
    return this.persist(input);
  }

  private async persist(input: CreateNotificationInput) {
    const data = notificationDataWithTargetRole(input.data, input.targetRole);
    const copy =
      input.resolveTemplate === false
        ? { title: input.title, body: input.body }
        : await this.resolveNotificationCopy(input);
    return this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: copy.title,
        body: copy.body,
        data: data === undefined ? undefined : toJson(data),
      },
    });

  }

  async retry(notificationId: string): Promise<RetryNotificationResult> {
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
            pushDevice: { select: { enabled: true, lastSeenAt: true, platform: true } },
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

  registerDeviceToken(user: AuthenticatedUser, input: RegisterDeviceTokenInput) {
    return this.prisma.pushDevice.upsert(pushDeviceRegistrationInput(user, input));
  }

  async disableDeviceToken(user: AuthenticatedUser, input: { token: string }) {
    const result = await this.prisma.pushDevice.updateMany(pushDeviceDisableInput(user.id, input.token));

    return { ok: result.count > 0, disabled: result.count };
  }

  private async resolveNotificationCopy(input: CreateNotificationInput) {
    const locale = await this.resolveNotificationLocale(input);
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { key: input.type },
      select: {
        enabled: true,
        translations: {
          where: { locale: { in: [locale, 'en'] } },
          select: {
            locale: true,
            title: true,
            body: true,
          },
        },
      },
    });

    if (!template?.enabled) {
      return { title: input.title, body: input.body };
    }

    const translation =
      template.translations.find((item) => item.locale === locale) ??
      template.translations.find((item) => item.locale === 'en');
    if (!translation) {
      return { title: input.title, body: input.body };
    }

    return {
      title: renderNotificationTemplateText(translation.title, input.data),
      body: renderNotificationTemplateText(translation.body, input.data),
    };
  }

  private async resolveNotificationLocale(
    input: CreateNotificationInput,
  ): Promise<NotificationTemplateLocale> {
    if (input.locale && isNotificationTemplateLocale(input.locale)) {
      return input.locale;
    }

    const pushDevice = await this.prisma.pushDevice.findFirst({
      where: {
        userId: input.userId,
        enabled: true,
        ...(input.targetRole ? { role: input.targetRole } : {}),
      },
      orderBy: { updatedAt: 'desc' },
      select: { locale: true },
    });

    const pushDeviceLocale = pushDevice?.locale ?? null;
    return pushDeviceLocale && isNotificationTemplateLocale(pushDeviceLocale) ? pushDeviceLocale : 'en';
  }

  private async enqueueNotificationSend(notificationId: string): Promise<NotificationRetryAuditJobSummary> {
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

function renderNotificationTemplateText(template: string, data: unknown) {
  const record = readPlainRecord(data);
  if (!record) {
    return template;
  }

  return template.replace(/\{([a-zA-Z0-9_.-]+)\}/g, (match, key: string) => {
    const value = record[key];
    return isTemplateScalar(value) ? String(value) : match;
  });
}

function readPlainRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function isTemplateScalar(value: unknown): value is string | number | boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
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
        pushDevice: { enabled: boolean; lastSeenAt: Date | null; platform: string } | null;
      }
    | undefined,
): NotificationRetryAuditLatestDelivery | null {
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
    pushDeviceLastSeenAt: delivery.pushDevice?.lastSeenAt?.toISOString() ?? null,
    pushDevicePlatform: delivery.pushDevice?.platform ?? null,
  };
}

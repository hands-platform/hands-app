import { InjectQueue } from '@nestjs/bullmq';
import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { notificationDeliveryFailureCode } from './notification-delivery-failure';
import {
  type RegisterDeviceTokenInput,
  pushDeviceDisableInput,
  pushDeviceRegistrationInput,
} from './notification-device-token';
import {
  NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,
  NOTIFICATION_SEND_QUEUE_NAME,
  notificationSendJob,
} from './notification-send.queue';
import { toJson } from './notification-push-payload';
import type {
  NotificationRetryAuditJobSummary,
  NotificationRetryAuditLatestDelivery,
  NotificationRetryAuditResult,
} from './notification-retry-audit';
import { notificationRetryDecision } from './notification-retry-decision';
import { notificationDataWithRuntimeScope } from './notification-data-scope';
import {
  type NotificationTemplateLocale,
  isNotificationTemplateLocale,
} from './notification-template-catalog';
import {
  notificationDataWithTargetRole,
  notificationTargetRole,
  pushDeviceMatchesTargetRole,
  type NotificationTargetRole,
} from './notification-target-role';
import { customerAppNotificationWhere } from './customer-app-notification.policy';

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

type ProviderChatRoomUnreadRow = {
  readonly chatRoomId: string;
  readonly unreadCount: number | bigint;
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
    const data = notificationDataWithRuntimeScope(
      notificationDataWithTargetRole(input.data, input.targetRole),
    );
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
        data: toJson(data),
      },
    });

  }

  async retry(notificationId: string): Promise<RetryNotificationResult> {
    const notification = await this.prisma.notification.findUniqueOrThrow({
      where: { id: notificationId },
      select: {
        data: true,
        id: true,
        type: true,
        deliveries: {
          orderBy: { attemptedAt: 'desc' },
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
        user: {
          select: {
            pushDevices: {
              where: { enabled: true },
              orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
              take: NOTIFICATION_SEND_PUSH_DEVICE_LIMIT,
              select: { createdAt: true, id: true, platform: true, role: true, updatedAt: true },
            },
          },
        },
      },
    });
    const targetRole = notificationTargetRole(notification);
    const targetDevices = notification.user.pushDevices.filter((device) =>
      pushDeviceMatchesTargetRole(device, targetRole),
    );
    if (targetDevices.length === 0) {
      throw new ConflictException('Notification has no enabled target-role push path');
    }

    const acceptedDeviceIds = new Set(
      notification.deliveries
        .filter((delivery) => delivery.status === 'SENT' && delivery.pushDeviceId)
        .map((delivery) => delivery.pushDeviceId as string),
    );
    const latestByDevice = new Map<string, (typeof notification.deliveries)[number]>();
    for (const delivery of notification.deliveries) {
      if (delivery.pushDeviceId && !latestByDevice.has(delivery.pushDeviceId)) {
        latestByDevice.set(delivery.pushDeviceId, delivery);
      }
    }
    const eligibleDevices = targetDevices.filter((device) => !acceptedDeviceIds.has(device.id));
    if (eligibleDevices.length === 0) {
      throw new ConflictException('Notification has no eligible unresolved push path');
    }

    const decision = notificationRetryDecision(targetDevices, notification.deliveries);
    if (decision.state !== 'allowed') {
      const condition = decision.retryAfterAt
        ? ` Retry cooldown ends at ${decision.retryAfterAt}.`
        : '';
      throw new ConflictException(`Notification retry blocked by failure policy. ${decision.reason}${condition}`);
    }
    const activeRetryJobId = await this.notificationQueue.getDeduplicationJobId(notification.id);
    if (activeRetryJobId) {
      throw new ConflictException('Notification retry is already queued');
    }

    const retrySnapshot = summarizeRetryPaths(targetDevices, eligibleDevices, latestByDevice, targetRole);
    const latestDelivery = summarizeRetryLatestDelivery(notification.deliveries[0]);
    const retryJob = await this.enqueueNotificationSend(notification.id);
    return { ok: true, notificationId: notification.id, latestDelivery, retryJob, retrySnapshot };
  }

  listForUser(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async listCustomerAppInbox(
    userId: string,
    options: { cursor?: string; take?: number } = {},
  ) {
    const take = options.take ?? 20;
    const where = customerAppNotificationWhere(userId);
    const [rows, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
        take: take + 1,
      }),
      this.prisma.notification.count({
        where: { ...where, readAt: null },
      }),
    ]);
    const hasMore = rows.length > take;
    const visibleRows = hasMore ? rows.slice(0, take) : rows;

    return {
      rows: visibleRows,
      unreadCount,
      pagination: {
        take,
        nextCursor: hasMore ? (visibleRows.at(-1)?.id ?? null) : null,
      },
    };
  }

  markRead(userId: string, notificationId: string) {
    return this.prisma.notification.update({
      where: { id: notificationId, userId },
      data: { readAt: new Date() },
    });
  }

  async providerChatSummary(userId: string) {
    const [unreadCount, roomRows] = await Promise.all([
      this.prisma.notification.count({
        where: providerUnreadChatNotificationWhere(userId),
      }),
      this.prisma.$queryRaw<ProviderChatRoomUnreadRow[]>(Prisma.sql`
        SELECT
          "data"->>'chatRoomId' AS "chatRoomId",
          COUNT(*)::int AS "unreadCount"
        FROM "Notification"
        WHERE "userId" = ${userId}
          AND "type" = 'chat.message.created'
          AND "readAt" IS NULL
          AND "data"->>'targetRole' = ${Role.PROVIDER}
          AND "data"->>'chatRoomId' IS NOT NULL
          AND "data"->>'chatRoomId' <> ''
        GROUP BY "data"->>'chatRoomId'
        ORDER BY MAX("createdAt") DESC
        LIMIT 50
      `),
    ]);

    return {
      unreadCount,
      rooms: roomRows.map((row) => ({
        chatRoomId: row.chatRoomId,
        unreadCount: Number(row.unreadCount),
      })),
    };
  }

  async markProviderChatRead(userId: string, chatRoomId: string) {
    const result = await this.prisma.notification.updateMany({
      where: providerUnreadChatNotificationWhere(userId, chatRoomId),
      data: { readAt: new Date() },
    });
    const summary = await this.providerChatSummary(userId);
    return { updated: result.count, ...summary };
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

  async enqueuePersistedNotification(notificationId: string) {
    try {
      await this.enqueueNotificationSend(notificationId);
      return true;
    } catch {
      return false;
    }
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

function providerUnreadChatNotificationWhere(
  userId: string,
  chatRoomId?: string,
): Prisma.NotificationWhereInput {
  return {
    userId,
    type: 'chat.message.created',
    readAt: null,
    AND: [
      {
        data: {
          path: ['targetRole'],
          equals: Role.PROVIDER,
        },
      },
      ...(chatRoomId
        ? [
            {
              data: {
                path: ['chatRoomId'],
                equals: chatRoomId,
              },
            },
          ]
        : []),
    ],
  };
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
    pushDeviceId: maskStableDeviceId(delivery.pushDeviceId),
    pushDeviceEnabled: delivery.pushDevice?.enabled ?? null,
    pushDeviceLastSeenAt: delivery.pushDevice?.lastSeenAt?.toISOString() ?? null,
    pushDevicePlatform: delivery.pushDevice?.platform ?? null,
  };
}

function summarizeRetryPaths(
  targetDevices: readonly { id: string; platform: string; role: Role }[],
  eligibleDevices: readonly { id: string; platform: string; role: Role }[],
  latestByDevice: ReadonlyMap<string, { status: string; response: unknown }>,
  targetRole: NotificationTargetRole | null,
) {
  const counts = { accepted: 0, failed: 0, skipped: 0, unattempted: 0 };
  const failureCodes = new Set<string>();
  for (const device of targetDevices) {
    const delivery = latestByDevice.get(device.id);
    if (!delivery) {
      counts.unattempted += 1;
    } else if (delivery.status === 'SENT') {
      counts.accepted += 1;
    } else if (delivery.status === 'FAILED') {
      counts.failed += 1;
      const code = notificationDeliveryFailureCode(delivery.response);
      if (code) failureCodes.add(code);
    } else {
      counts.skipped += 1;
    }
  }
  return {
    ...counts,
    eligibleDeviceCount: eligibleDevices.length,
    eligibleDeviceIds: eligibleDevices.map((device) => maskStableDeviceId(device.id)),
    failureCodes: [...failureCodes].sort(),
    skippedSuccessfulDeviceCount: targetDevices.length - eligibleDevices.length,
    targetRole,
  };
}

function maskStableDeviceId(value: string | null) {
  if (!value) return null;
  if (value.length <= 8) return `device:***${value.slice(-3)}`;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

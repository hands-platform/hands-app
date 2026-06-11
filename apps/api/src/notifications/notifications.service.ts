import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Queue } from 'bullmq';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_SEND_QUEUE_NAME,
  notificationSendJob,
} from './notification-send.queue';

type CreateNotificationInput = {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: unknown;
};

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(NOTIFICATION_SEND_QUEUE_NAME) private readonly notificationQueue: Queue,
  ) {}

  async create(input: CreateNotificationInput) {
    const notification = await this.prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        data: input.data === undefined ? undefined : JSON.parse(JSON.stringify(input.data)),
      },
    });

    await this.enqueueNotificationSend(notification.id);

    return notification;
  }

  async retry(notificationId: string) {
    const notification = await this.prisma.notification.findUniqueOrThrow({ where: { id: notificationId } });
    await this.enqueueNotificationSend(notification.id);
    return { ok: true, notificationId: notification.id };
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
    const role = resolvePushDeviceRole(user.roles);
    const lastSeenAt = new Date();

    return this.prisma.pushDevice.upsert({
      where: { token: input.token },
      update: {
        userId: user.id,
        role,
        platform: input.platform,
        enabled: true,
        lastSeenAt,
      },
      create: {
        userId: user.id,
        role,
        token: input.token,
        platform: input.platform,
        lastSeenAt,
      },
    });
  }

  async disableDeviceToken(user: AuthenticatedUser, input: { token: string }) {
    const result = await this.prisma.pushDevice.updateMany({
      where: { userId: user.id, token: input.token },
      data: { enabled: false, lastSeenAt: new Date() },
    });

    return { ok: result.count > 0, disabled: result.count };
  }

  private async enqueueNotificationSend(notificationId: string) {
    const job = notificationSendJob(notificationId);
    await this.notificationQueue.add(job.name, job.data, job.options);
  }
}

function resolvePushDeviceRole(roles: readonly Role[]) {
  if (roles.includes(Role.CUSTOMER)) {
    return Role.CUSTOMER;
  }

  if (roles.includes(Role.PROVIDER)) {
    return Role.PROVIDER;
  }

  return Role.ADMIN;
}

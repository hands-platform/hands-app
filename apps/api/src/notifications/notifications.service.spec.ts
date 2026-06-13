import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService device tokens', () => {
  it('registers an FCM token for the authenticated provider user', async () => {
    const prisma = {
      pushDevice: {
        upsert: jest.fn().mockResolvedValue({ id: 'device-1' }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.registerDeviceToken(
        { id: 'user-1', roles: [Role.PROVIDER] },
        { token: 'fcm-token-1', platform: 'android' },
      ),
    ).resolves.toEqual({ id: 'device-1' });

    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith({
      where: { token: 'fcm-token-1' },
      update: {
        userId: 'user-1',
        role: Role.PROVIDER,
        platform: 'android',
        enabled: true,
        lastSeenAt: expect.any(Date),
      },
      create: {
        userId: 'user-1',
        role: Role.PROVIDER,
        token: 'fcm-token-1',
        platform: 'android',
        lastSeenAt: expect.any(Date),
      },
    });
  });

  it('keeps provider app token registration on the active provider role for multi-role users', async () => {
    const prisma = {
      pushDevice: {
        upsert: jest.fn().mockResolvedValue({ id: 'device-1' }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await service.registerDeviceToken(
      { id: 'user-1', activeRole: Role.PROVIDER, roles: [Role.CUSTOMER, Role.PROVIDER] },
      { token: 'fcm-token-1', platform: 'android' },
    );

    expect(prisma.pushDevice.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({ role: Role.PROVIDER }),
        create: expect.objectContaining({ role: Role.PROVIDER }),
      }),
    );
  });

  it('disables only the authenticated user device token', async () => {
    const prisma = {
      pushDevice: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.disableDeviceToken({ id: 'user-1', roles: [Role.CUSTOMER] }, { token: 'fcm-token-1' }),
    ).resolves.toEqual({ ok: true, disabled: 1 });

    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: 'fcm-token-1' },
      data: { enabled: false, lastSeenAt: expect.any(Date) },
    });
  });
});

describe('NotificationsService retry queue', () => {
  const standardQueueOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: false,
  };

  it('enqueues created notifications with the standard retry policy', async () => {
    const notification = { id: 'notification-1' };
    const prisma = {
      notification: {
        create: jest.fn().mockResolvedValue(notification),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.create({
        userId: 'user-1',
        type: 'booking.requested',
        title: 'Booking request',
        body: 'A booking request is available.',
        data: { bookingId: 'booking-1', createdAt: new Date('2026-06-11T00:00:00.000Z') },
      }),
    ).resolves.toEqual(notification);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'booking.requested',
        title: 'Booking request',
        body: 'A booking request is available.',
        data: { bookingId: 'booking-1', createdAt: '2026-06-11T00:00:00.000Z' },
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-1' },
      standardQueueOptions,
    );
  });

  it('stores target role metadata for role-scoped push delivery', async () => {
    const notification = { id: 'notification-1' };
    const prisma = {
      notification: {
        create: jest.fn().mockResolvedValue(notification),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await service.create({
      userId: 'user-1',
      targetRole: Role.PROVIDER,
      type: 'booking.requested',
      title: 'Booking request',
      body: 'A booking request is available.',
      data: { bookingId: 'booking-1' },
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: { bookingId: 'booking-1', targetRole: Role.PROVIDER },
      }),
    });
  });

  it('re-enqueues an existing notification with the standard retry policy', async () => {
    const prisma = {
      notification: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 'notification-1', deliveries: [] }),
      },
    };
    const queue = { add: jest.fn().mockResolvedValue({ id: 'queued-retry-job-1' }) };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.retry('notification-1')).resolves.toEqual({
      latestDelivery: null,
      ok: true,
      notificationId: 'notification-1',
      retryJob: {
        attempts: 3,
        backoffMs: 5000,
        jobName: 'notification-send',
        queueName: 'notification-retry',
        queuedJobId: 'queued-retry-job-1',
      },
    });

    expect(prisma.notification.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'notification-1' },
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
    expect(queue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-1' },
      standardQueueOptions,
    );
  });

  it('returns latest delivery evidence when retrying a recovered notification', async () => {
    const prisma = {
      notification: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'notification-1',
          deliveries: [
            {
              id: 'delivery-1',
              provider: 'FCM',
              status: 'SENT',
              attemptedAt: new Date('2026-06-13T10:23:00.000Z'),
              response: { name: 'projects/hands/messages/message-1' },
              pushDeviceId: 'push-device-1',
              pushDevice: { enabled: true, platform: 'android' },
            },
          ],
        }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.retry('notification-1')).resolves.toEqual({
      latestDelivery: {
        attemptedAt: '2026-06-13T10:23:00.000Z',
        failureCode: null,
        id: 'delivery-1',
        provider: 'FCM',
        pushDeviceEnabled: true,
        pushDeviceId: 'push-device-1',
        pushDevicePlatform: 'android',
        status: 'SENT',
      },
      ok: true,
      notificationId: 'notification-1',
      retryJob: {
        attempts: 3,
        backoffMs: 5000,
        jobName: 'notification-send',
        queueName: 'notification-retry',
        queuedJobId: null,
      },
    });
  });

  it('returns latest delivery failure code when retrying a failed notification', async () => {
    const prisma = {
      notification: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'notification-1',
          deliveries: [
            {
              id: 'delivery-1',
              provider: 'FCM',
              status: 'FAILED',
              attemptedAt: new Date('2026-06-13T10:23:00.000Z'),
              response: { failureCode: 'messaging/mismatched-credential' },
              pushDeviceId: 'push-device-1',
              pushDevice: { enabled: true, platform: 'android' },
            },
          ],
        }),
      },
    };
    const queue = { add: jest.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.retry('notification-1')).resolves.toMatchObject({
      latestDelivery: {
        failureCode: 'messaging/mismatched-credential',
        status: 'FAILED',
      },
      ok: true,
      notificationId: 'notification-1',
      retryJob: {
        attempts: 3,
        backoffMs: 5000,
        jobName: 'notification-send',
        queueName: 'notification-retry',
        queuedJobId: null,
      },
    });
  });
});

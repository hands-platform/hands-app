import { Role } from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService device tokens', () => {
  it('registers an FCM token for the authenticated provider user', async () => {
    const prisma = {
      pushDevice: {
        upsert: vi.fn().mockResolvedValue({ id: 'device-1' }),
      },
    };
    const queue = { add: vi.fn() };
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
        pushProvider: 'FCM',
        enabled: true,
        lastSeenAt: expect.any(Date),
      },
      create: {
        userId: 'user-1',
        role: Role.PROVIDER,
        token: 'fcm-token-1',
        platform: 'android',
        pushProvider: 'FCM',
        lastSeenAt: expect.any(Date),
      },
    });
  });

  it('keeps provider app token registration on the active provider role for multi-role users', async () => {
    const prisma = {
      pushDevice: {
        upsert: vi.fn().mockResolvedValue({ id: 'device-1' }),
      },
    };
    const queue = { add: vi.fn() };
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
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.disableDeviceToken({ id: 'user-1', roles: [Role.CUSTOMER] }, { token: 'fcm-token-1' }),
    ).resolves.toEqual({ ok: true, disabled: 1 });

    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: 'fcm-token-1' },
      data: { enabled: false, lastSeenAt: expect.any(Date) },
    });
  });

  it('returns a safe false result when no authenticated device token is disabled', async () => {
    const prisma = {
      pushDevice: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.disableDeviceToken({ id: 'user-1', roles: [Role.CUSTOMER] }, { token: 'missing-token' }),
    ).resolves.toEqual({ ok: false, disabled: 0 });

    expect(prisma.pushDevice.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: 'missing-token' },
      data: { enabled: false, lastSeenAt: expect.any(Date) },
    });
  });
});

describe('NotificationsService retry queue', () => {
  const standardQueueOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    deduplication: {
      id: 'notification-1',
      keepLastIfActive: true,
    },
    removeOnComplete: true,
    removeOnFail: false,
  };

  it('enqueues created notifications with the standard retry policy', async () => {
    const notification = { id: 'notification-1' };
    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue(notification),
      },
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      pushDevice: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const queue = { add: vi.fn() };
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
        data: {
          bookingId: 'booking-1',
          createdAt: '2026-06-11T00:00:00.000Z',
          dataScope: 'synthetic',
        },
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-1' },
      standardQueueOptions,
    );
  });

  it('creates Admin in-app notifications without enqueuing mobile push delivery', async () => {
    const notification = { id: 'notification-admin-1' };
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue(notification) },
      notificationTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
      pushDevice: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.createInApp({
      body: 'An overdue bank statement batch needs reconciliation.',
      data: { batchImportId: 'batch-1' },
      resolveTemplate: false,
      title: 'Finance reconciliation assigned',
      type: 'admin.finance.bank_statement_batch.escalated',
      userId: 'admin-1',
    })).resolves.toEqual(notification);
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'admin.finance.bank_statement_batch.escalated',
        userId: 'admin-1',
      }),
    });
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('uses enabled language template copy when creating a notification', async () => {
    const notification = { id: 'notification-1' };
    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue(notification),
      },
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          enabled: true,
          translations: [
            {
              locale: 'vi',
              title: 'Yêu cầu mới',
              body: 'Đơn {bookingId} từ {customerName} đang sẵn sàng.',
            },
            {
              locale: 'en',
              title: 'New request',
              body: 'Booking {bookingId} is ready.',
            },
          ],
        }),
      },
      pushDevice: {
        findFirst: vi.fn().mockResolvedValue({ locale: 'vi' }),
      },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.create({
        userId: 'user-1',
        targetRole: Role.PROVIDER,
        type: 'booking.requested',
        title: 'Booking request',
        body: 'A booking request is available.',
        data: { bookingId: 'booking-1', customerName: 'Linh' },
      }),
    ).resolves.toEqual(notification);

    expect(prisma.pushDevice.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        enabled: true,
        role: Role.PROVIDER,
      },
      orderBy: { updatedAt: 'desc' },
      select: { locale: true },
    });
    expect(prisma.notificationTemplate.findUnique).toHaveBeenCalledWith({
      where: { key: 'booking.requested' },
      select: {
        enabled: true,
        translations: {
          where: { locale: { in: ['vi', 'en'] } },
          select: {
            locale: true,
            title: true,
            body: true,
          },
        },
      },
    });
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'booking.requested',
        title: 'Yêu cầu mới',
        body: 'Đơn booking-1 từ Linh đang sẵn sàng.',
        data: {
          bookingId: 'booking-1',
          customerName: 'Linh',
          dataScope: 'synthetic',
          targetRole: Role.PROVIDER,
        },
      },
    });
  });

  it('keeps explicit notification copy when template resolution is disabled', async () => {
    const notification = { id: 'notification-1' };
    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue(notification),
      },
      notificationTemplate: {
        findUnique: vi.fn(),
      },
      pushDevice: {
        findFirst: vi.fn(),
      },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.create({
        userId: 'user-1',
        targetRole: Role.PROVIDER,
        type: 'admin.push.broadcast',
        resolveTemplate: false,
        title: 'Manual Partner update',
        body: 'Open HANDS for today updates.',
        data: { campaignId: 'campaign-1' },
      }),
    ).resolves.toEqual(notification);

    expect(prisma.pushDevice.findFirst).not.toHaveBeenCalled();
    expect(prisma.notificationTemplate.findUnique).not.toHaveBeenCalled();
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: 'admin.push.broadcast',
        title: 'Manual Partner update',
        body: 'Open HANDS for today updates.',
        data: {
          campaignId: 'campaign-1',
          dataScope: 'synthetic',
          targetRole: Role.PROVIDER,
        },
      },
    });
  });

  it('stores target role metadata for role-scoped push delivery', async () => {
    const notification = { id: 'notification-1' };
    const prisma = {
      notification: {
        create: vi.fn().mockResolvedValue(notification),
      },
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      pushDevice: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    const queue = { add: vi.fn() };
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
        data: {
          bookingId: 'booking-1',
          dataScope: 'synthetic',
          targetRole: Role.PROVIDER,
        },
      }),
    });
  });

  it('blocks retry when no classified failed path exists', async () => {
    const prisma = {
      notification: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          data: { targetRole: Role.CUSTOMER },
          id: 'notification-1',
          type: 'payment.updated',
          deliveries: [],
          user: {
            pushDevices: [{ id: 'push-device-1', platform: 'android', role: Role.CUSTOMER }],
          },
        }),
      },
    };
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'queued-retry-job-1' }),
      getDeduplicationJobId: vi.fn().mockResolvedValue(null),
    };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.retry('notification-1')).rejects.toThrow(
      'No classified delivery failure is available for a safe retry',
    );

    expect(prisma.notification.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'notification-1' } }),
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rejects retry when every target path was already accepted', async () => {
    const prisma = {
      notification: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'notification-1',
          data: { targetRole: Role.CUSTOMER },
          type: 'payment.updated',
          user: {
            pushDevices: [{ id: 'push-device-1', platform: 'android', role: Role.CUSTOMER }],
          },
          deliveries: [
            {
              id: 'delivery-1',
              provider: 'FCM',
              status: 'SENT',
              attemptedAt: new Date('2026-06-13T10:23:00.000Z'),
              response: { name: 'projects/hands/messages/message-1' },
              pushDeviceId: 'push-device-1',
              pushDevice: {
                enabled: true,
                lastSeenAt: new Date('2026-06-13T10:22:00.000Z'),
                platform: 'android',
              },
            },
          ],
        }),
      },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.retry('notification-1')).rejects.toThrow(
      'Notification has no eligible unresolved push path',
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('returns latest delivery failure code when retrying an eligible transient failure', async () => {
    const prisma = {
      notification: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          id: 'notification-1',
          data: { targetRole: Role.PROVIDER },
          type: 'booking.requested',
          user: {
            pushDevices: [{ id: 'push-device-1', platform: 'android', role: Role.PROVIDER }],
          },
          deliveries: [
            {
              id: 'delivery-1',
              provider: 'FCM',
              status: 'FAILED',
              attemptedAt: new Date('2026-06-13T10:23:00.000Z'),
              response: { failureCode: 'messaging/internal-error' },
              pushDeviceId: 'push-device-1',
              pushDevice: { enabled: true, platform: 'android' },
            },
          ],
        }),
      },
    };
    const queue = { add: vi.fn(), getDeduplicationJobId: vi.fn().mockResolvedValue(null) };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.retry('notification-1')).resolves.toMatchObject({
      latestDelivery: {
        failureCode: 'messaging/internal-error',
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

  it('lists only customer app inbox notification types with cursor pagination', async () => {
    const rows = [
      { id: 'notification-1', type: 'admin.push.broadcast' },
      { id: 'notification-2', type: 'customer.wallet.manual_adjustment' },
      { id: 'notification-3', type: 'customer.referral.reward_credited' },
    ];
    const prisma = {
      notification: {
        count: vi.fn().mockResolvedValue(2),
        findMany: vi.fn().mockResolvedValue(rows),
      },
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(
      service.listCustomerAppInbox('customer-user-1', { cursor: 'previous-row', take: 2 }),
    ).resolves.toEqual({
      rows: rows.slice(0, 2),
      unreadCount: 2,
      pagination: { nextCursor: 'notification-2', take: 2 },
    });
    expect(prisma.notification.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'customer-user-1',
        type: {
          in: [
            'admin.push.broadcast',
            'customer.referral.reward_credited',
            'customer.wallet.manual_adjustment',
          ],
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      cursor: { id: 'previous-row' },
      skip: 1,
      take: 3,
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: 'customer-user-1',
        readAt: null,
        type: {
          in: [
            'admin.push.broadcast',
            'customer.referral.reward_credited',
            'customer.wallet.manual_adjustment',
          ],
        },
      },
    });
  });

  it('counts only unread provider chat notifications', async () => {
    const prisma = {
      notification: {
        count: vi.fn().mockResolvedValue(3),
      },
      $queryRaw: vi.fn().mockResolvedValue([
        { chatRoomId: 'chat-room-2', unreadCount: 2 },
        { chatRoomId: 'chat-room-1', unreadCount: BigInt(1) },
      ]),
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(service.providerChatSummary('provider-user-1')).resolves.toEqual({
      unreadCount: 3,
      rooms: [
        { chatRoomId: 'chat-room-2', unreadCount: 2 },
        { chatRoomId: 'chat-room-1', unreadCount: 1 },
      ],
    });
    expect(prisma.notification.count).toHaveBeenCalledWith({
      where: {
        userId: 'provider-user-1',
        type: 'chat.message.created',
        readAt: null,
        AND: [
          {
            data: {
              path: ['targetRole'],
              equals: Role.PROVIDER,
            },
          },
        ],
      },
    });
    expect(prisma.$queryRaw).toHaveBeenCalledOnce();
  });

  it('marks only one provider chat room read and returns the remaining count', async () => {
    const prisma = {
      notification: {
        updateMany: vi.fn().mockResolvedValue({ count: 2 }),
        count: vi.fn().mockResolvedValue(1),
      },
      $queryRaw: vi
        .fn()
        .mockResolvedValue([{ chatRoomId: 'chat-room-2', unreadCount: 1 }]),
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(
      service.markProviderChatRead('provider-user-1', 'chat-room-1'),
    ).resolves.toEqual({
      updated: 2,
      unreadCount: 1,
      rooms: [{ chatRoomId: 'chat-room-2', unreadCount: 1 }],
    });
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 'provider-user-1',
        type: 'chat.message.created',
        readAt: null,
        AND: [
          {
            data: {
              path: ['targetRole'],
              equals: Role.PROVIDER,
            },
          },
          {
            data: {
              path: ['chatRoomId'],
              equals: 'chat-room-1',
            },
          },
        ],
      },
      data: { readAt: expect.any(Date) },
    });
  });
});

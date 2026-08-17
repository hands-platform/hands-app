import { Role } from '@prisma/client';
import {
  NotificationsService,
  createNotifications,
  notificationRecoveryAuditPayloads,
} from './notifications.service';

describe('NotificationsService role isolation', () => {
  it('filters role-targeted notifications for a dual-role identity', async () => {
    const prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'customer-1', type: 'booking.opened', data: { targetRole: Role.CUSTOMER } },
          { id: 'provider-1', type: 'booking.requested', data: { targetRole: Role.PROVIDER } },
          { id: 'shared-1', type: 'system.notice', data: {} },
          { id: 'ambiguous-1', type: 'chat.message.created', data: {} },
        ]),
      },
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(service.listForUser('user-1', Role.PROVIDER)).resolves.toEqual([
      expect.objectContaining({ id: 'provider-1' }),
      expect.objectContaining({ id: 'shared-1' }),
    ]);
  });

  it('rejects a push notification when its app role cannot be resolved', async () => {
    const prisma = { notification: { create: vi.fn() } };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(
      service.create({
        body: 'A new message is available.',
        title: 'New message',
        type: 'chat.message.created',
        userId: 'user-1',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'NOTIFICATION_TARGET_ROLE_REQUIRED' }),
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('stores an inferred role for a legacy role-specific notification', async () => {
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue({ id: 'notification-1' }) },
      notificationTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
      pushDevice: { findFirst: vi.fn().mockResolvedValue(null) },
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await service.create({
      body: 'Your payment changed.',
      title: 'Payment update',
      type: 'payment.updated',
      userId: 'user-1',
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        data: expect.objectContaining({ targetRole: Role.CUSTOMER }),
      }),
    });
  });

  it('exposes a source-keyed notification as safe post-commit recovery evidence', async () => {
    const prisma = {
      $transaction: vi.fn().mockRejectedValue(new Error('database unavailable')),
      notificationTemplate: { findUnique: vi.fn() },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);
    const input = {
      body: 'Your booking is ready.',
      resolveTemplate: false,
      sourceKey: 'booking:booking-1:opened:user-1',
      targetRole: Role.CUSTOMER,
      title: 'Booking ready',
      type: 'booking.opened',
      userId: 'user-1',
    } as const;

    const error = await service.create(input).catch((failure: unknown) => failure);

    expect(notificationRecoveryAuditPayloads(error)).toEqual([input]);
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('retains every failed source-keyed input from a notification batch', async () => {
    const service = {
      create: vi.fn().mockImplementation((input: { sourceKey: string }) => {
        const prisma = {
          $transaction: vi.fn().mockRejectedValue(new Error(`failed:${input.sourceKey}`)),
          notificationTemplate: { findUnique: vi.fn() },
        };
        return new NotificationsService(prisma as never, { add: vi.fn() } as never).create({
          body: 'Body',
          resolveTemplate: false,
          sourceKey: input.sourceKey,
          targetRole: Role.CUSTOMER,
          title: 'Title',
          type: 'booking.opened',
          userId: 'user-1',
        });
      }),
    };
    const inputs = [{ sourceKey: 'source-1' }, { sourceKey: 'source-2' }];

    const error = await createNotifications(service as never, inputs as never).catch(
      (failure: unknown) => failure,
    );

    expect(notificationRecoveryAuditPayloads(error)).toEqual([
      expect.objectContaining({ sourceKey: 'source-1' }),
      expect.objectContaining({ sourceKey: 'source-2' }),
    ]);
  });

  it('does not mark another app role notification as read', async () => {
    const prisma = {
      notification: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'customer-1',
          type: 'booking.opened',
          data: { targetRole: Role.CUSTOMER },
        }),
        update: vi.fn(),
      },
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(service.markRead('user-1', 'customer-1', Role.PROVIDER)).rejects.toThrow(
      'Notification was not found',
    );
    expect(prisma.notification.update).not.toHaveBeenCalled();
  });
});

describe('NotificationsService manual Push persistence', () => {
  it('claims a snapshotted recipient before creating its single notification', async () => {
    const tx = {
      adminPushCampaignRecipient: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ notificationId: null, status: 'SNAPSHOTTED' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        update: vi.fn().mockResolvedValue({}),
      },
      notification: {
        create: vi.fn().mockResolvedValue({ id: 'notification-1' }),
        findUniqueOrThrow: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(
      service.persistAdminPushRecipient({
        body: 'Campaign body',
        campaignId: 'campaign-1',
        data: { campaignId: 'campaign-1', locale: 'vi' },
        locale: 'vi',
        resolveTemplate: false,
        targetRole: Role.PROVIDER,
        title: 'Campaign title',
        type: 'admin.push.broadcast',
        userId: 'user-1',
      }),
    ).resolves.toEqual({ id: 'notification-1' });

    expect(tx.adminPushCampaignRecipient.updateMany).toHaveBeenCalledWith({
      where: {
        campaignId: 'campaign-1',
        userId: 'user-1',
        notificationId: null,
        status: 'SNAPSHOTTED',
      },
      data: { status: 'PROCESSING' },
    });
    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.adminPushCampaignRecipient.update).toHaveBeenCalledWith({
      where: { campaignId_userId: { campaignId: 'campaign-1', userId: 'user-1' } },
      data: { notificationId: 'notification-1' },
    });
  });

  it('reuses the linked notification on a campaign retry', async () => {
    const existingNotification = { id: 'notification-existing' };
    const tx = {
      adminPushCampaignRecipient: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({
          notificationId: existingNotification.id,
          status: 'PROCESSING',
        }),
        updateMany: vi.fn(),
        update: vi.fn(),
      },
      notification: {
        create: vi.fn(),
        findUniqueOrThrow: vi.fn().mockResolvedValue(existingNotification),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const service = new NotificationsService(prisma as never, { add: vi.fn() } as never);

    await expect(
      service.persistAdminPushRecipient({
        body: 'Campaign body',
        campaignId: 'campaign-1',
        targetRole: Role.CUSTOMER,
        title: 'Campaign title',
        type: 'admin.push.broadcast',
        userId: 'user-1',
      }),
    ).resolves.toEqual(existingNotification);

    expect(tx.adminPushCampaignRecipient.updateMany).not.toHaveBeenCalled();
    expect(tx.notification.create).not.toHaveBeenCalled();
  });
});

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
    removeOnFail: { count: 500 },
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
          deliveryIntent: 'PUSH_AND_IN_APP',
          managedTemplateKey: 'booking.requested',
          targetRole: Role.PROVIDER,
        },
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-1' },
      standardQueueOptions,
    );
  });

  it('reuses a source-keyed notification when queue registration is retried', async () => {
    const notification = { id: 'notification-1' };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([{ pg_advisory_xact_lock: null }]),
      notification: {
        create: vi.fn().mockResolvedValue(notification),
        findFirst: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(notification),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    const queue = {
      add: vi.fn()
        .mockRejectedValueOnce(new Error('Redis unavailable'))
        .mockResolvedValueOnce({ id: 'notification-1' }),
    };
    const service = new NotificationsService(prisma as never, queue as never);
    const input = {
      body: 'A booking update is ready.',
      resolveTemplate: false,
      sourceKey: 'booking:booking-1:opened:user-1',
      targetRole: Role.CUSTOMER,
      title: 'Booking update',
      type: 'booking.opened',
      userId: 'user-1',
    } as const;

    await expect(service.create(input)).rejects.toThrow('Redis unavailable');
    await expect(service.create(input)).resolves.toEqual(notification);

    expect(tx.notification.create).toHaveBeenCalledTimes(1);
    expect(tx.notification.findFirst).toHaveBeenCalledTimes(2);
    expect(queue.add).toHaveBeenCalledTimes(2);
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
              status: 'READY',
              title: 'Yêu cầu mới',
              body: 'Đơn {bookingId} từ {customerName} đang sẵn sàng.',
            },
            {
              locale: 'en',
              status: 'READY',
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
            status: true,
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
          deliveryIntent: 'PUSH_AND_IN_APP',
          managedTemplateKey: 'booking.requested',
          targetRole: Role.PROVIDER,
        },
      },
    });
  });

  it('uses the role-specific Partner template and falls back to READY English copy', async () => {
    const notification = { id: 'notification-partner-matched' };
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue(notification) },
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          enabled: true,
          translations: [
            { body: 'Bản dịch chưa được duyệt.', locale: 'vi', status: 'NEEDS_REVIEW', title: 'Đã ghép' },
            { body: 'Open chat and start the service.', locale: 'en', status: 'READY', title: 'Booking matched' },
          ],
        }),
      },
      pushDevice: { findFirst: vi.fn().mockResolvedValue({ locale: 'vi' }) },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.create({
      body: 'The customer selected you. Open chat to continue.',
      data: { bookingId: 'booking-1' },
      targetRole: Role.PROVIDER,
      title: 'You were selected',
      type: 'booking.matched',
      userId: 'partner-user-1',
    })).resolves.toEqual(notification);

    expect(prisma.notificationTemplate.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { key: 'booking.matched.partner' },
    }));
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: 'Open chat and start the service.',
        data: expect.objectContaining({ managedTemplateKey: 'booking.matched.partner' }),
        title: 'Booking matched',
      }),
    });
  });

  it('uses caller fallback when READY managed copy has an unresolved payload variable', async () => {
    const notification = { id: 'notification-fallback' };
    const prisma = {
      notification: { create: vi.fn().mockResolvedValue(notification) },
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue({
          enabled: true,
          translations: [
            { body: '{partnerName} joined your booking.', locale: 'en', status: 'READY', title: 'Partner joined' },
          ],
        }),
      },
      pushDevice: { findFirst: vi.fn().mockResolvedValue({ locale: 'en' }) },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.create({
      body: 'A Partner joined your booking.',
      data: { bookingId: 'booking-1' },
      targetRole: Role.CUSTOMER,
      title: 'Partner joined',
      type: 'provider.joined',
      userId: 'customer-user-1',
    })).resolves.toEqual(notification);

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        body: 'A Partner joined your booking.',
        title: 'Partner joined',
      }),
    });
    expect(queue.add).toHaveBeenCalledTimes(1);
  });

  it('blocks persistence and enqueue when caller fallback still has unresolved variables', async () => {
    const prisma = {
      notification: { create: vi.fn() },
      notificationTemplate: { findUnique: vi.fn() },
      pushDevice: { findFirst: vi.fn() },
    };
    const queue = { add: vi.fn() };
    const service = new NotificationsService(prisma as never, queue as never);

    await expect(service.create({
      body: '{partnerName} joined your booking.',
      data: { bookingId: 'booking-1' },
      targetRole: Role.CUSTOMER,
      title: 'Partner joined',
      type: 'provider.joined',
      userId: 'customer-user-1',
    })).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'NOTIFICATION_COPY_UNRESOLVED_VARIABLE',
        unresolvedVariables: ['partnerName'],
      }),
    });

    expect(prisma.notification.create).not.toHaveBeenCalled();
    expect(queue.add).not.toHaveBeenCalled();
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
          deliveryIntent: 'PUSH_AND_IN_APP',
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
          deliveryIntent: 'PUSH_AND_IN_APP',
          managedTemplateKey: 'booking.requested',
          targetRole: Role.PROVIDER,
        },
      }),
    });
  });

  it('allows a controlled retry when no provider delivery attempt exists', async () => {
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

    await expect(service.retry('notification-1')).resolves.toMatchObject({
      notificationId: 'notification-1',
      ok: true,
      retrySnapshot: { unattempted: 1 },
    });

    expect(prisma.notification.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'notification-1' } }),
    );
    expect(queue.add).toHaveBeenCalledOnce();
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

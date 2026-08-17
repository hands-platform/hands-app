import { Role } from '@prisma/client';
import { chatNotificationRoutingData } from './notification-push-payload';
import {
  adminPushDeliveryState,
  adminPushLatestDeliveryCounts,
  NotificationRetryProcessor,
  notificationSendPushDeviceOrder,
} from './notifications.processor';
import { NotificationsService } from './notifications.service';

function createNotificationRetryProcessor(
  prisma: {
    notification: { findUnique: ReturnType<typeof vi.fn> };
    pushDevice?: { findMany?: ReturnType<typeof vi.fn> };
  },
  pushDelivery: Record<string, unknown>,
) {
  prisma.pushDevice ??= {};
  prisma.pushDevice.findMany ??= vi.fn(async (input: {
    take?: number;
    where?: {
      id?: { in?: string[] };
      locale?: { startsWith?: string };
      role?: Role;
    };
  }) => {
    const latestLookup = prisma.notification.findUnique.mock.results.at(-1)?.value;
    const notification = latestLookup ? await latestLookup : null;
    const devices = (notification?.user?.pushDevices ?? []).filter(
      (device: { id: string; role?: Role; locale?: string }) =>
        (!input.where?.role || device.role === input.where.role) &&
        (!input.where?.id?.in || input.where.id.in.includes(device.id)) &&
        (!input.where?.locale?.startsWith ||
          device.locale?.toLowerCase().startsWith(input.where.locale.startsWith.toLowerCase())),
    );
    return devices.slice(0, input.take);
  });
  return new NotificationRetryProcessor(prisma as never, pushDelivery as never);
}

let deliverySequence = 0;

function deliveryTransactionFixture() {
  return {
    $queryRaw: vi.fn(),
    notificationDelivery: {
      create: vi.fn().mockImplementation(async () => ({ id: `delivery-${++deliverySequence}` })),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    pushDevice: {
      update: vi.fn(),
    },
  };
}

describe('NotificationRetryProcessor', () => {
  it('skips an ambiguous notification without querying or sending to app devices', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-ambiguous',
          userId: 'user-1',
          title: 'New message',
          body: 'A new message is available.',
          type: 'chat.message.created',
          data: { chatRoomId: 'chat-1' },
          deliveries: [],
        }),
      },
      pushDevice: { findMany: vi.fn() },
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-ambiguous' } } as never),
    ).resolves.toEqual({
      skipped: true,
      reason: 'MISSING_TARGET_ROLE',
      notificationId: 'notification-ambiguous',
    });

    expect(prisma.pushDevice.findMany).not.toHaveBeenCalled();
    expect(pushDelivery.send).not.toHaveBeenCalled();
  });

  it('preserves the Partner chat contract from persistence through queued FCM delivery', async () => {
    let storedNotification: Record<string, unknown> | undefined;
    const tx = deliveryTransactionFixture();
    const prisma = {
      notification: {
        create: vi.fn(async (input: { data: Record<string, unknown> }) => {
          storedNotification = { id: 'notification-chat-1', ...input.data };
          return storedNotification;
        }),
        findUnique: vi.fn(async () =>
          storedNotification
            ? {
                ...storedNotification,
                user: {
                  pushDevices: [
                    {
                      id: 'device-customer',
                      role: Role.CUSTOMER,
                      token: 'fcm-token-customer',
                    },
                    {
                      id: 'device-provider',
                      role: Role.PROVIDER,
                      token: 'fcm-token-provider',
                    },
                  ],
                },
              }
            : null,
        ),
      },
      notificationTemplate: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      pushDevice: {
        findFirst: vi.fn().mockResolvedValue({ locale: 'en' }),
      },
      operationalPolicySetting: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const queue = {
      add: vi.fn().mockResolvedValue({ id: 'notification-job-1' }),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const notifications = new NotificationsService(prisma as never, queue as never);
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await notifications.create({
      userId: 'partner-user-1',
      targetRole: Role.PROVIDER,
      type: 'chat.message.created',
      title: 'New chat message',
      body: 'A new message is available in your booking chat.',
      data: chatNotificationRoutingData({
        bookingId: 'booking-1',
        chatRoomId: 'chat-room-1',
      }),
    });

    expect(storedNotification).toMatchObject({
      id: 'notification-chat-1',
      data: {
        destination: 'chat',
        bookingId: 'booking-1',
        chatRoomId: 'chat-room-1',
        targetRole: Role.PROVIDER,
      },
    });
    expect(queue.add).toHaveBeenCalledWith(
      'notification-send',
      { notificationId: 'notification-chat-1' },
      expect.objectContaining({ attempts: 3 }),
    );

    const queuedData = queue.add.mock.calls[0]?.[1];
    await expect(processor.process({ data: queuedData } as never)).resolves.toMatchObject({
      notificationId: 'notification-chat-1',
      userId: 'partner-user-1',
      results: [{ deviceId: 'device-provider', status: 'SENT' }],
    });

    expect(pushDelivery.send).toHaveBeenCalledTimes(1);
    expect(pushDelivery.send).toHaveBeenCalledWith({
      token: 'fcm-token-provider',
      title: 'New chat message',
      body: 'A new message is available in your booking chat.',
      data: {
        destination: 'chat',
        bookingId: 'booking-1',
        chatRoomId: 'chat-room-1',
        targetRole: Role.PROVIDER,
        type: 'chat.message.created',
        notificationId: 'notification-chat-1',
      },
      providerOverride: undefined,
    });
    expect(JSON.stringify(pushDelivery.send.mock.calls)).not.toContain('fcm-token-customer');
    expect(prisma.operationalPolicySetting.findUnique).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.create).toHaveBeenCalledTimes(1);
  });

  it('skips missing notifications without sending push delivery', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(processor.process({ data: { notificationId: 'missing' } } as never)).resolves.toEqual({
      skipped: true,
    });

    expect(pushDelivery.send).not.toHaveBeenCalled();
  });

  it('skips notifications without enabled push devices before resolving partner-alert policy', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking available',
          body: 'A booking is available.',
          type: 'booking.backup_available',
          data: { bookingId: 'booking-1' },
          user: {
            pushDevices: [],
          },
        }),
      },
      operationalPolicySetting: {
        findUnique: vi.fn(),
      },
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toEqual({
      skipped: true,
      reason: 'NO_ENABLED_TARGET_ROLE_DEVICES',
      notificationId: 'notification-1',
      targetRole: Role.PROVIDER,
    });

    expect(prisma.operationalPolicySetting.findUnique).not.toHaveBeenCalled();
    expect(pushDelivery.send).not.toHaveBeenCalled();
    expect(prisma.pushDevice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: notificationSendPushDeviceOrder,
        take: 10,
        where: expect.objectContaining({ enabled: true, role: Role.PROVIDER, userId: 'user-1' }),
      }),
    );
  });

  it('routes partner alert notifications through FCM only when policy selects FCM push', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking available',
          body: 'A booking is available.',
          type: 'booking.backup_available',
          data: { bookingId: 'booking-1' },
          user: {
            pushDevices: [{ id: 'device-1', role: Role.PROVIDER, token: 'fcm-token-1' }],
          },
        }),
      },
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 'FCM_FOR_ALL_BOOKINGS' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: unknown) => Promise<void>) =>
        callback(deliveryTransactionFixture()),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await processor.process({ data: { notificationId: 'notification-1' } } as never);

    expect(pushDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'fcm',
      }),
    );
  });

  it('routes partner alert notifications to in-app delivery when policy has not enabled FCM', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking available',
          body: 'A booking is available.',
          type: 'booking.backup_available',
          data: { bookingId: 'booking-1' },
          user: {
            pushDevices: [{ id: 'device-1', role: Role.PROVIDER, token: 'fcm-token-1' }],
          },
        }),
      },
      operationalPolicySetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 'IN_APP_WITH_PUSH_LATER' }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: unknown) => Promise<void>) =>
        callback(deliveryTransactionFixture()),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'IN_APP_ONLY',
        status: 'SKIPPED',
        disableDevice: false,
        response: { reason: 'FCM push not enabled for partner alerts.' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await processor.process({ data: { notificationId: 'notification-1' } } as never);

    expect(pushDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: 'in_app_only',
      }),
    );
  });

  it('sends non partner alerts without reading partner alert policy', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Payment update',
          body: 'Your payment status changed.',
          type: 'payment.updated',
          data: { bookingId: 'booking-1', paymentId: 'payment-1' },
          user: {
            pushDevices: [{ id: 'device-1', role: Role.CUSTOMER, token: 'fcm-token-1' }],
          },
        }),
      },
      operationalPolicySetting: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (callback: (transactionClient: unknown) => Promise<void>) =>
        callback(deliveryTransactionFixture()),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await processor.process({ data: { notificationId: 'notification-1' } } as never);

    expect(prisma.operationalPolicySetting.findUnique).not.toHaveBeenCalled();
    expect(pushDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: undefined,
      }),
    );
  });

  it('sends only target-role push devices when notification data carries targetRole', async () => {
    const tx = deliveryTransactionFixture();
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Earning created',
          body: 'A completed service was added to earnings.',
          type: 'earning.created',
          data: { bookingId: 'booking-1', targetRole: Role.PROVIDER },
          user: {
            pushDevices: [
              { id: 'device-customer', role: Role.CUSTOMER, token: 'fcm-token-customer' },
              { id: 'device-provider', role: Role.PROVIDER, token: 'fcm-token-provider' },
            ],
          },
        }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      notificationId: 'notification-1',
      userId: 'user-1',
      results: [{ deviceId: 'device-provider', status: 'SENT' }],
    });

    expect(pushDelivery.send).toHaveBeenCalledTimes(1);
    expect(pushDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fcm-token-provider' }),
    );
    expect(JSON.stringify(pushDelivery.send.mock.calls)).not.toContain('fcm-token-customer');
    expect(tx.notificationDelivery.create).toHaveBeenCalledTimes(1);
  });

  it('retries only devices without a previous successful delivery', async () => {
    const tx = deliveryTransactionFixture();
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'New chat message',
          body: 'A new message is available in your booking chat.',
          type: 'chat.message.created',
          data: {
            destination: 'chat',
            bookingId: 'booking-1',
            chatRoomId: 'chat-room-1',
            targetRole: Role.PROVIDER,
          },
          deliveries: [{ pushDeviceId: 'device-already-sent' }],
          user: {
            pushDevices: [
              {
                id: 'device-already-sent',
                role: Role.PROVIDER,
                token: 'fcm-token-already-sent',
              },
              {
                id: 'device-needs-retry',
                role: Role.PROVIDER,
                token: 'fcm-token-needs-retry',
              },
            ],
          },
        }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      notificationId: 'notification-1',
      results: [{ deviceId: 'device-needs-retry', status: 'SENT' }],
      skippedDeliveredDeviceCount: 1,
    });

    expect(pushDelivery.send).toHaveBeenCalledTimes(1);
    expect(pushDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({ token: 'fcm-token-needs-retry' }),
    );
    expect(JSON.stringify(pushDelivery.send.mock.calls)).not.toContain('fcm-token-already-sent');
    expect(tx.notificationDelivery.create).toHaveBeenCalledTimes(1);
  });

  it('does not send twice while another worker owns a fresh device delivery claim', async () => {
    const tx = deliveryTransactionFixture();
    tx.notificationDelivery.findFirst.mockResolvedValue({
      attemptedAt: new Date(),
      id: 'delivery-processing',
      provider: 'FCM',
      status: 'PROCESSING',
    });
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'payment.updated',
          data: { bookingId: 'booking-1', targetRole: Role.CUSTOMER },
          deliveries: [],
        }),
      },
      pushDevice: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'device-1', role: Role.CUSTOMER, token: 'fcm-token-1' },
        ]),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      results: [{ deviceId: 'device-1', status: 'PROCESSING' }],
    });
    expect(pushDelivery.send).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it('marks a stale delivery claim unknown without resending an uncertain push', async () => {
    const tx = deliveryTransactionFixture();
    tx.notificationDelivery.findFirst.mockResolvedValue({
      attemptedAt: new Date('2026-08-01T00:00:00.000Z'),
      id: 'delivery-stale',
      provider: 'FCM',
      status: 'PROCESSING',
    });
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'payment.updated',
          data: { bookingId: 'booking-1', targetRole: Role.CUSTOMER },
          deliveries: [],
        }),
      },
      pushDevice: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'device-1', role: Role.CUSTOMER, token: 'fcm-token-1' },
        ]),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      results: [
        {
          deviceId: 'device-1',
          status: 'FAILED',
          failureCode: 'DELIVERY_OUTCOME_UNKNOWN',
        },
      ],
    });
    expect(pushDelivery.send).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: 'delivery-stale' },
      data: expect.objectContaining({
        status: 'FAILED',
        response: expect.objectContaining({ failureCode: 'DELIVERY_OUTCOME_UNKNOWN' }),
      }),
    });
  });

  it('never resends a delivery whose provider outcome was already marked unknown', async () => {
    const tx = deliveryTransactionFixture();
    tx.notificationDelivery.findFirst.mockResolvedValue({
      attemptedAt: new Date('2026-08-01T00:00:00.000Z'),
      id: 'delivery-unknown',
      provider: 'FCM',
      response: { failureCode: 'DELIVERY_OUTCOME_UNKNOWN' },
      status: 'FAILED',
    });
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'payment.updated',
          data: { bookingId: 'booking-1', targetRole: Role.CUSTOMER },
          deliveries: [],
        }),
      },
      pushDevice: {
        findMany: vi.fn().mockResolvedValue([
          { id: 'device-1', role: Role.CUSTOMER, token: 'fcm-token-1' },
        ]),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      results: [
        {
          deviceId: 'device-1',
          status: 'FAILED',
          failureCode: 'DELIVERY_OUTCOME_UNKNOWN',
        },
      ],
    });
    expect(pushDelivery.send).not.toHaveBeenCalled();
    expect(tx.notificationDelivery.create).not.toHaveBeenCalled();
  });

  it('skips a retry when every target device was already delivered successfully', async () => {
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'New chat message',
          body: 'A new message is available in your booking chat.',
          type: 'chat.message.created',
          data: {
            destination: 'chat',
            bookingId: 'booking-1',
            chatRoomId: 'chat-room-1',
            targetRole: Role.PROVIDER,
          },
          deliveries: [{ pushDeviceId: 'device-provider' }],
          user: {
            pushDevices: [
              {
                id: 'device-provider',
                role: Role.PROVIDER,
                token: 'fcm-token-provider',
              },
            ],
          },
        }),
      },
    };
    const pushDelivery = { send: vi.fn() };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toEqual({
      skipped: true,
      reason: 'ALREADY_DELIVERED',
      notificationId: 'notification-1',
      skippedDeliveredDeviceCount: 1,
    });

    expect(pushDelivery.send).not.toHaveBeenCalled();
  });

  it('sends only the recent push-device budget for one notification job', async () => {
    const tx = deliveryTransactionFixture();
    const devices = Array.from({ length: 12 }, (_, index) => ({
      id: `device-${index + 1}`,
      role: Role.CUSTOMER,
      token: `fcm-token-${index + 1}`,
    }));
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'payment.updated',
          data: { bookingId: 'booking-1' },
          user: {
            pushDevices: devices,
          },
        }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      notificationId: 'notification-1',
      userId: 'user-1',
      results: devices.slice(0, 10).map((device) => ({
        deviceId: device.id,
        status: 'SENT',
      })),
    });

    expect(pushDelivery.send).toHaveBeenCalledTimes(10);
    expect(tx.notificationDelivery.create).toHaveBeenCalledTimes(10);
    expect(JSON.stringify(pushDelivery.send.mock.calls)).not.toContain('fcm-token-11');
    expect(JSON.stringify(pushDelivery.send.mock.calls)).not.toContain('fcm-token-12');
  });

  it('records one delivery result per enabled push device without disabling transient failures', async () => {
    const tx = deliveryTransactionFixture();
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'payment.updated',
          data: { bookingId: 'booking-1' },
          user: {
            pushDevices: [
              { id: 'device-1', role: Role.CUSTOMER, token: 'fcm-token-1' },
              { id: 'device-2', role: Role.CUSTOMER, token: 'fcm-token-2' },
            ],
          },
        }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: vi
        .fn()
        .mockResolvedValueOnce({
          provider: 'FCM',
          status: 'SENT',
          disableDevice: false,
          response: { messageId: 'fcm-message-1' },
        })
        .mockResolvedValueOnce({
          provider: 'FCM',
          status: 'FAILED',
          disableDevice: false,
          failureCode: 'messaging/internal-error',
          response: { reason: 'temporary provider error for fcm-token-2' },
        }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).rejects.toThrow('retryable push delivery failure');

    expect(pushDelivery.send).toHaveBeenCalledTimes(2);
    expect(tx.notificationDelivery.create).toHaveBeenCalledTimes(2);
    expect(tx.notificationDelivery.update).toHaveBeenNthCalledWith(2, {
      where: { id: expect.any(String) },
      data: {
        provider: 'FCM',
        status: 'FAILED',
        response: {
          reason: 'temporary provider error for [masked]',
          failureCode: 'messaging/internal-error',
        },
      },
    });
    expect(tx.pushDevice.update).not.toHaveBeenCalled();
  });

  it('disables a push device after a permanent FCM token failure', async () => {
    const tx = deliveryTransactionFixture();
    const prisma = {
      notification: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'chat.message.created',
          data: {
            chatRoomId: 'chat-1',
            internalNote: 'do not send',
            targetRole: Role.PROVIDER,
          },
          user: {
            pushDevices: [
              {
                id: 'device-1',
                role: Role.PROVIDER,
                token: 'fcm-token-1',
              },
            ],
          },
        }),
      },
      $transaction: vi.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: vi.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'FAILED',
        disableDevice: true,
        failureCode: 'messaging/registration-token-not-registered',
        response: { reason: 'registration token fcm-token-1 leaked from provider response' },
      }),
    };
    const processor = createNotificationRetryProcessor(prisma, pushDelivery);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toMatchObject({
      notificationId: 'notification-1',
      userId: 'user-1',
      results: [
        {
          deviceId: 'device-1',
          provider: 'FCM',
          status: 'FAILED',
          disableDevice: true,
          failureCode: 'messaging/registration-token-not-registered',
        },
      ],
    });

    expect(pushDelivery.send).toHaveBeenCalledWith({
      token: 'fcm-token-1',
      title: 'Booking update',
      body: 'A booking update is available.',
      data: {
        chatRoomId: 'chat-1',
        targetRole: Role.PROVIDER,
        type: 'chat.message.created',
        notificationId: 'notification-1',
      },
      providerOverride: undefined,
    });
    expect(tx.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: expect.any(String) },
      data: {
        provider: 'FCM',
        status: 'FAILED',
        response: {
          reason: 'registration token [masked] leaked from provider response',
          failureCode: 'messaging/registration-token-not-registered',
        },
      },
    });
    expect(JSON.stringify(tx.notificationDelivery.update.mock.calls)).not.toContain('fcm-token-1');
    expect(tx.pushDevice.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: { enabled: false, lastSeenAt: expect.any(Date) },
    });
  });
});

describe('adminPushDeliveryState', () => {
  it.each([
    {
      label: 'keeps the campaign processing while any device is pending',
      input: {
        eligibleDeviceCount: 3,
        deliveredDeviceCount: 1,
        failedDeviceCount: 0,
        skippedDeviceCount: 0,
      },
      expected: { pendingDeviceCount: 2, status: 'PROCESSING' },
    },
    {
      label: 'completes only when every eligible device succeeded',
      input: {
        eligibleDeviceCount: 2,
        deliveredDeviceCount: 2,
        failedDeviceCount: 0,
        skippedDeviceCount: 0,
      },
      expected: { pendingDeviceCount: 0, status: 'COMPLETED' },
    },
    {
      label: 'records a partial failure when success and terminal failure coexist',
      input: {
        eligibleDeviceCount: 3,
        deliveredDeviceCount: 1,
        failedDeviceCount: 1,
        skippedDeviceCount: 1,
      },
      expected: { pendingDeviceCount: 0, status: 'PARTIAL_FAILED' },
    },
    {
      label: 'fails when no eligible device succeeded',
      input: {
        eligibleDeviceCount: 2,
        deliveredDeviceCount: 0,
        failedDeviceCount: 2,
        skippedDeviceCount: 0,
      },
      expected: { pendingDeviceCount: 0, status: 'FAILED' },
    },
  ])('$label', ({ input, expected }) => {
    expect(adminPushDeliveryState(input)).toEqual(expected);
  });
});

describe('adminPushLatestDeliveryCounts', () => {
  it('uses only the latest attempt per device after a controlled retry', () => {
    expect(
      adminPushLatestDeliveryCounts([
        { pushDeviceId: 'device-1', status: 'SENT' },
        { pushDeviceId: 'device-1', status: 'FAILED' },
        { pushDeviceId: 'device-2', status: 'SKIPPED' },
      ]),
    ).toEqual({
      deliveredDeviceCount: 1,
      failedDeviceCount: 0,
      recordedSkippedDeviceCount: 1,
    });
  });
});

import { Role } from '@prisma/client';
import { NotificationRetryProcessor } from './notifications.processor';

describe('NotificationRetryProcessor', () => {
  it('skips missing notifications without sending push delivery', async () => {
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const pushDelivery = { send: jest.fn() };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

    await expect(processor.process({ data: { notificationId: 'missing' } } as never)).resolves.toEqual({
      skipped: true,
    });

    expect(pushDelivery.send).not.toHaveBeenCalled();
  });

  it('skips notifications without enabled push devices before resolving partner-alert policy', async () => {
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn(),
      },
    };
    const pushDelivery = { send: jest.fn() };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

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
  });

  it('routes partner alert notifications through FCM only when policy selects FCM push', async () => {
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({ value: 'FCM_FOR_ALL_BOOKINGS' }),
      },
      $transaction: jest.fn(async (callback: (transactionClient: unknown) => Promise<void>) =>
        callback({
          notificationDelivery: { create: jest.fn() },
          pushDevice: { update: jest.fn() },
        }),
      ),
    };
    const pushDelivery = {
      send: jest.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

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
        findUnique: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn().mockResolvedValue({ value: 'IN_APP_WITH_PUSH_LATER' }),
      },
      $transaction: jest.fn(async (callback: (transactionClient: unknown) => Promise<void>) =>
        callback({
          notificationDelivery: { create: jest.fn() },
          pushDevice: { update: jest.fn() },
        }),
      ),
    };
    const pushDelivery = {
      send: jest.fn().mockResolvedValue({
        provider: 'IN_APP_ONLY',
        status: 'SKIPPED',
        disableDevice: false,
        response: { reason: 'FCM push not enabled for partner alerts.' },
      }),
    };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

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
        findUnique: jest.fn().mockResolvedValue({
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
        findUnique: jest.fn(),
      },
      $transaction: jest.fn(async (callback: (transactionClient: unknown) => Promise<void>) =>
        callback({
          notificationDelivery: { create: jest.fn() },
          pushDevice: { update: jest.fn() },
        }),
      ),
    };
    const pushDelivery = {
      send: jest.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

    await processor.process({ data: { notificationId: 'notification-1' } } as never);

    expect(prisma.operationalPolicySetting.findUnique).not.toHaveBeenCalled();
    expect(pushDelivery.send).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOverride: undefined,
      }),
    );
  });

  it('sends only target-role push devices when notification data carries targetRole', async () => {
    const tx = {
      notificationDelivery: {
        create: jest.fn(),
      },
      pushDevice: {
        update: jest.fn(),
      },
    };
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
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
      $transaction: jest.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: jest.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'SENT',
        disableDevice: false,
        response: { messageId: 'fcm-message-1' },
      }),
    };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

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

  it('records one delivery result per enabled push device without disabling transient failures', async () => {
    const tx = {
      notificationDelivery: {
        create: jest.fn(),
      },
      pushDevice: {
        update: jest.fn(),
      },
    };
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
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
      $transaction: jest.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: jest
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
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

    await expect(
      processor.process({ data: { notificationId: 'notification-1' } } as never),
    ).resolves.toEqual({
      notificationId: 'notification-1',
      userId: 'user-1',
      results: [
        {
          deviceId: 'device-1',
          provider: 'FCM',
          status: 'SENT',
          disableDevice: false,
          failureCode: undefined,
        },
        {
          deviceId: 'device-2',
          provider: 'FCM',
          status: 'FAILED',
          disableDevice: false,
          failureCode: 'messaging/internal-error',
        },
      ],
    });

    expect(pushDelivery.send).toHaveBeenCalledTimes(2);
    expect(tx.notificationDelivery.create).toHaveBeenCalledTimes(2);
    expect(tx.notificationDelivery.create).toHaveBeenNthCalledWith(2, {
      data: {
        notificationId: 'notification-1',
        pushDeviceId: 'device-2',
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
    const tx = {
      notificationDelivery: {
        create: jest.fn(),
      },
      pushDevice: {
        update: jest.fn(),
      },
    };
    const prisma = {
      notification: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'notification-1',
          userId: 'user-1',
          title: 'Booking update',
          body: 'A booking update is available.',
          type: 'chat.message.created',
          data: { chatRoomId: 'chat-1', internalNote: 'do not send' },
          user: {
            pushDevices: [
              {
                id: 'device-1',
                token: 'fcm-token-1',
              },
            ],
          },
        }),
      },
      $transaction: jest.fn(async (callback: (transactionClient: typeof tx) => Promise<void>) =>
        callback(tx),
      ),
    };
    const pushDelivery = {
      send: jest.fn().mockResolvedValue({
        provider: 'FCM',
        status: 'FAILED',
        disableDevice: true,
        failureCode: 'messaging/registration-token-not-registered',
        response: { reason: 'registration token fcm-token-1 leaked from provider response' },
      }),
    };
    const processor = new NotificationRetryProcessor(prisma as never, pushDelivery as never);

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
      data: { chatRoomId: 'chat-1', notificationId: 'notification-1' },
      providerOverride: undefined,
    });
    expect(tx.notificationDelivery.create).toHaveBeenCalledWith({
      data: {
        notificationId: 'notification-1',
        pushDeviceId: 'device-1',
        provider: 'FCM',
        status: 'FAILED',
        response: {
          reason: 'registration token [masked] leaked from provider response',
          failureCode: 'messaging/registration-token-not-registered',
        },
      },
    });
    expect(JSON.stringify(tx.notificationDelivery.create.mock.calls)).not.toContain('fcm-token-1');
    expect(tx.pushDevice.update).toHaveBeenCalledWith({
      where: { id: 'device-1' },
      data: { enabled: false, lastSeenAt: expect.any(Date) },
    });
  });
});

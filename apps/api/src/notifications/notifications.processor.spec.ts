import { NotificationRetryProcessor, isPartnerAlert, toPushData } from './notifications.processor';

describe('notification push data', () => {
  it('keeps OS push data limited to routing identifiers', () => {
    expect(
      toPushData({
        bookingId: 'booking-1',
        chatRoomId: 'chat-1',
        payoutBatchId: 'payout-batch-1',
        providerProfileId: 'provider-1',
        reason: 'Internal operator note',
        addressText: 'Private customer address',
        nested: { unsafe: true },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      chatRoomId: 'chat-1',
      payoutBatchId: 'payout-batch-1',
      providerProfileId: 'provider-1',
    });
  });

  it('omits push data when no safe keys are present', () => {
    expect(toPushData({ reason: 'Internal operator note' })).toBeUndefined();
    expect(toPushData(null)).toBeUndefined();
  });

  it('keeps payout setup detail objects out of OS push data', () => {
    expect(
      toPushData({
        bookingId: 'booking-1',
        providerProfileId: 'provider-1',
        missing: {
          taxProfileApproved: true,
          residentialAddress: true,
          agreements: ['PAYOUT'],
        },
      }),
    ).toEqual({
      bookingId: 'booking-1',
      providerProfileId: 'provider-1',
    });
  });
});

describe('notification partner alert policy', () => {
  it('includes payout setup and payout batch updates in partner alert channel policy', () => {
    expect(isPartnerAlert('provider.payout_setup_required')).toBe(true);
    expect(isPartnerAlert('provider.payout_batch.updated')).toBe(true);
  });

  it('keeps customer payment updates out of partner alert channel policy', () => {
    expect(isPartnerAlert('payment.updated')).toBe(false);
  });
});

describe('NotificationRetryProcessor', () => {
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
            pushDevices: [{ id: 'device-1', token: 'fcm-token-1' }],
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
      data: { chatRoomId: 'chat-1' },
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
      data: { enabled: false },
    });
  });
});

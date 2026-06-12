import { ConfigService } from '@nestjs/config';
import { FCM_ANDROID_NOTIFICATION_CHANNEL_ID, PushDeliveryService } from './push-delivery.service';

const mockMessagingSend = jest.fn();

jest.mock('firebase-admin/app', () => ({
  applicationDefault: jest.fn(() => ({ type: 'applicationDefault' })),
  cert: jest.fn((credential) => ({ credential })),
  getApps: jest.fn(() => []),
  initializeApp: jest.fn(() => ({ name: 'hands-fcm' })),
}));

jest.mock('firebase-admin/messaging', () => ({
  getMessaging: jest.fn(() => ({ send: mockMessagingSend })),
}));

function pushService(env: Record<string, string | undefined>) {
  return new PushDeliveryService(new ConfigService(env));
}

describe('PushDeliveryService', () => {
  const message = {
    token: 'fcm-demo-token',
    title: 'Booking update',
    body: 'A booking update is available.',
    data: { bookingId: 'booking-1' },
  };

  it('keeps local delivery in-app only by default', async () => {
    await expect(pushService({}).send(message)).resolves.toMatchObject({
      provider: 'IN_APP_ONLY',
      status: 'SKIPPED',
      disableDevice: false,
    });
  });

  it('fails safely when FCM is selected without Firebase Admin credentials', async () => {
    await expect(pushService({ PUSH_PROVIDER: 'fcm' }).send(message)).resolves.toMatchObject({
      provider: 'FCM',
      status: 'FAILED',
      disableDevice: false,
      failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
    });
  });

  it('masks raw FCM tokens from provider error messages', async () => {
    mockMessagingSend.mockRejectedValueOnce(
      Object.assign(
        new Error(
          'Requested entity was not found: registration token: fcm-demo-token. Raw token fcm-demo-token rejected.',
        ),
        { code: 'messaging/registration-token-not-registered' },
      ),
    );

    const result = await pushService({
      PUSH_PROVIDER: 'fcm',
      FIREBASE_PROJECT_ID: 'hands-demo',
      FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.test',
      FIREBASE_PRIVATE_KEY: 'placeholder-firebase-admin-private-key',
    }).send(message);

    expect(result).toMatchObject({
      provider: 'FCM',
      status: 'FAILED',
      disableDevice: true,
      failureCode: 'messaging/registration-token-not-registered',
      response: {
        reason: 'Requested entity was not found: registration token [masked]. Raw token [masked] rejected.',
      },
    });
    expect(JSON.stringify(result.response)).not.toContain('fcm-demo-token');
  });

  it('sends Android FCM notifications through the HANDS priority channel', async () => {
    mockMessagingSend.mockResolvedValueOnce('firebase-message-1');

    await expect(
      pushService({
        PUSH_PROVIDER: 'fcm',
        FIREBASE_PROJECT_ID: 'hands-demo',
        FIREBASE_CLIENT_EMAIL: 'firebase-admin@example.test',
        FIREBASE_PRIVATE_KEY: 'placeholder-firebase-admin-private-key',
      }).send(message),
    ).resolves.toMatchObject({
      provider: 'FCM',
      status: 'SENT',
      response: { messageId: 'firebase-message-1' },
    });

    expect(mockMessagingSend).toHaveBeenLastCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({
          priority: 'high',
          notification: {
            channelId: FCM_ANDROID_NOTIFICATION_CHANNEL_ID,
          },
        }),
      }),
    );
  });
});

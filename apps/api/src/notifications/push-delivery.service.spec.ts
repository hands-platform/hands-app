import { ConfigService } from '@nestjs/config';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FCM_ANDROID_NOTIFICATION_CHANNEL_ID, PushDeliveryService } from './push-delivery.service';

const mockJwtGetAccessToken = jest.fn();
const mockGoogleAuthGetAccessToken = jest.fn();
const mockGoogleAuthGetClient = jest.fn();
const mockFetch = jest.fn();
const originalFetch = global.fetch;

jest.mock('google-auth-library', () => ({
  GoogleAuth: jest.fn().mockImplementation(() => ({
    getClient: mockGoogleAuthGetClient,
  })),
  JWT: jest.fn().mockImplementation(() => ({
    getAccessToken: mockJwtGetAccessToken,
  })),
}));

function pushService(env: Record<string, string | undefined>) {
  return new PushDeliveryService(new ConfigService(env));
}

function fcmResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe('PushDeliveryService', () => {
  let tempDir: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    mockJwtGetAccessToken.mockResolvedValue({ token: 'jwt-access-token' });
    mockGoogleAuthGetAccessToken.mockResolvedValue({ token: 'google-auth-access-token' });
    mockGoogleAuthGetClient.mockResolvedValue({ getAccessToken: mockGoogleAuthGetAccessToken });
    mockFetch.mockResolvedValue(fcmResponse({ name: 'projects/hands-demo/messages/firebase-message-1' }));
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

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
      response: {
        reason: 'FCM push delivery is disabled. Notification is available in the in-app inbox.',
      },
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

  it('fails safely when application default credentials point to a missing file', async () => {
    await expect(
      pushService({
        PUSH_PROVIDER: 'fcm',
        GOOGLE_APPLICATION_CREDENTIALS: 'C:\\secure\\missing-firebase-admin.json',
      }).send(message),
    ).resolves.toMatchObject({
      provider: 'FCM',
      status: 'FAILED',
      disableDevice: false,
      failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
      response: {
        invalid: ['GOOGLE_APPLICATION_CREDENTIALS'],
      },
    });
  });

  it('fails safely when application default credentials file is not a service account', async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'hands-fcm-'));
    const serviceAccountPath = join(tempDir, 'firebase-admin.json');
    writeFileSync(serviceAccountPath, '{}');

    await expect(
      pushService({
        PUSH_PROVIDER: 'fcm',
        GOOGLE_APPLICATION_CREDENTIALS: serviceAccountPath,
      }).send(message),
    ).resolves.toMatchObject({
      provider: 'FCM',
      status: 'FAILED',
      disableDevice: false,
      failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
      response: {
        invalid: ['GOOGLE_APPLICATION_CREDENTIALS'],
      },
    });
  });

  it('fails safely when service account JSON is present but incomplete', async () => {
    await expect(
      pushService({
        PUSH_PROVIDER: 'fcm',
        FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
      }).send(message),
    ).resolves.toMatchObject({
      provider: 'FCM',
      status: 'FAILED',
      disableDevice: false,
      failureCode: 'PUSH_PROVIDER_NOT_CONFIGURED',
      response: {
        invalid: ['FIREBASE_SERVICE_ACCOUNT_JSON'],
      },
    });
  });

  it('masks raw FCM tokens from provider error messages', async () => {
    mockFetch.mockResolvedValueOnce(
      fcmResponse(
        {
          error: {
            status: 'NOT_FOUND',
            message:
              'Requested entity was not found: registration token: fcm-demo-token. Raw token fcm-demo-token rejected.',
            details: [{ errorCode: 'UNREGISTERED' }],
          },
        },
        false,
        404,
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
      failureCode: 'UNREGISTERED',
      response: {
        reason: 'Requested entity was not found: registration token [masked]. Raw token [masked] rejected.',
      },
    });
    expect(JSON.stringify(result.response)).not.toContain('fcm-demo-token');
  });

  it('disables invalid FCM registration tokens returned as invalid-argument', async () => {
    mockFetch.mockResolvedValueOnce(
      fcmResponse(
        {
          error: {
            status: 'INVALID_ARGUMENT',
            message: 'The registration token fcm-demo-token not a valid FCM registration token',
          },
        },
        false,
        400,
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
      failureCode: 'INVALID_ARGUMENT',
      response: {
        reason: 'The registration token [masked] not a valid FCM registration token',
      },
    });
    expect(JSON.stringify(result.response)).not.toContain('fcm-demo-token');
  });

  it('sends Android FCM notifications through the HANDS priority channel', async () => {
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
      response: { messageId: 'projects/hands-demo/messages/firebase-message-1' },
    });

    expect(mockFetch).toHaveBeenLastCalledWith(
      'https://fcm.googleapis.com/v1/projects/hands-demo/messages:send',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer jwt-access-token',
        }),
        body: expect.stringContaining(FCM_ANDROID_NOTIFICATION_CHANNEL_ID),
      }),
    );
    const lastRequest = mockFetch.mock.calls[mockFetch.mock.calls.length - 1]?.[1] as RequestInit;
    expect(JSON.parse(String(lastRequest.body))).toMatchObject({
      message: {
        android: {
          priority: 'high',
          notification: {
            channelId: FCM_ANDROID_NOTIFICATION_CHANNEL_ID,
          },
        },
      },
    });
  });
});

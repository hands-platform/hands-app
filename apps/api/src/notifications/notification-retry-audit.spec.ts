import { notificationRetryAuditMetadata } from './notification-retry-audit';

const retryJob = {
  attempts: 3,
  backoffMs: 5000,
  jobName: 'notification-send',
  queueName: 'notification-retry',
  queuedJobId: 'queued-retry-job-1',
};

describe('notification retry audit metadata', () => {
  it('flags successful latest delivery retries as duplicate-send risk', () => {
    expect(
      notificationRetryAuditMetadata('notification-1', {
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
        retryJob,
      }),
    ).toEqual({
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
      notificationId: 'notification-1',
      operatorAction: 'Retry only after support confirms the user missed the latest delivered alert.',
      retryAlreadyDelivered: true,
      retryJob,
      retryRisk: 'DUPLICATE_SEND_RISK',
    });
  });

  it('keeps failed delivery evidence actionable', () => {
    expect(
      notificationRetryAuditMetadata('notification-1', {
        latestDelivery: {
          attemptedAt: '2026-06-13T10:23:00.000Z',
          failureCode: 'messaging/mismatched-credential',
          id: 'delivery-1',
          provider: 'FCM',
          pushDeviceEnabled: true,
          pushDeviceId: 'push-device-1',
          pushDevicePlatform: 'android',
          status: 'FAILED',
        },
        retryJob,
      }),
    ).toMatchObject({
      operatorAction: 'Fix the latest delivery failure before retrying.',
      retryAlreadyDelivered: false,
      retryRisk: 'FAILED_DELIVERY_RETRY',
    });
  });

  it('prioritizes disabled device recovery when latest delivery used a disabled device', () => {
    expect(
      notificationRetryAuditMetadata('notification-1', {
        latestDelivery: {
          attemptedAt: '2026-06-13T10:23:00.000Z',
          failureCode: 'messaging/registration-token-not-registered',
          id: 'delivery-1',
          provider: 'FCM',
          pushDeviceEnabled: false,
          pushDeviceId: 'push-device-1',
          pushDevicePlatform: 'android',
          status: 'FAILED',
        },
        retryJob,
      }),
    ).toMatchObject({
      operatorAction: 'Refresh or re-enable the push device before relying on retry delivery.',
      retryRisk: 'DEVICE_DISABLED',
    });
  });

  it('marks retries without delivery evidence for worker review', () => {
    expect(
      notificationRetryAuditMetadata('notification-1', {
        latestDelivery: null,
        retryJob,
      }),
    ).toMatchObject({
      latestDelivery: null,
      operatorAction: 'Confirm notification workers and queue processing before retrying.',
      retryAlreadyDelivered: false,
      retryRisk: 'NO_DELIVERY_EVIDENCE',
    });
  });
});

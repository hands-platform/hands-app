import {
  notificationDeliveryCreateInput,
  notificationDeliveryJobResult,
} from './notification-delivery-record';

describe('notification delivery record helpers', () => {
  const failedResult = {
    provider: 'FCM' as const,
    status: 'FAILED' as const,
    disableDevice: true,
    failureCode: 'messaging/registration-token-not-registered',
    response: { reason: 'registration token fcm-token-1 leaked' },
  };

  it('builds masked delivery create input from a push send result', () => {
    expect(
      notificationDeliveryCreateInput({
        notificationId: 'notification-1',
        pushDeviceId: 'device-1',
        pushToken: 'fcm-token-1',
        result: failedResult,
      }),
    ).toEqual({
      data: {
        notificationId: 'notification-1',
        pushDeviceId: 'device-1',
        provider: 'FCM',
        status: 'FAILED',
        response: {
          reason: 'registration token [masked] leaked',
          failureCode: 'messaging/registration-token-not-registered',
        },
      },
    });
  });

  it('projects worker result fields without raw provider response data', () => {
    expect(notificationDeliveryJobResult({ deviceId: 'device-1', result: failedResult })).toEqual({
      deviceId: 'device-1',
      status: 'FAILED',
      provider: 'FCM',
      disableDevice: true,
      failureCode: 'messaging/registration-token-not-registered',
    });
  });
});

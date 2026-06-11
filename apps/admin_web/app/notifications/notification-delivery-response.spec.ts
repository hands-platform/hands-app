import {
  notificationDeliveryFailureCode,
  notificationDeliveryFailureReason,
  type NotificationDelivery,
} from './notification-delivery-response';

describe('notification delivery response helpers', () => {
  it('reads current push processor failure details', () => {
    const delivery = deliveryResponse({
      failureCode: 'messaging/registration-token-not-registered',
      reason: 'registration token [masked]',
    });

    expect(notificationDeliveryFailureCode(delivery)).toBe(
      'messaging/registration-token-not-registered',
    );
    expect(notificationDeliveryFailureReason(delivery)).toBe('registration token [masked]');
  });

  it('reads nested provider error details', () => {
    const delivery = deliveryResponse({
      body: {
        error: {
          code: 'INVALID_ARGUMENT',
          message: 'Invalid push payload',
          details: [{ errorCode: 'BAD_TOKEN', errorMessage: 'Token is invalid' }],
        },
      },
    });

    expect(notificationDeliveryFailureCode(delivery)).toBe('BAD_TOKEN');
    expect(notificationDeliveryFailureReason(delivery)).toBe('Invalid push payload');
  });
});

function deliveryResponse(response: NonNullable<NotificationDelivery['response']>): NotificationDelivery {
  return {
    attemptedAt: '2026-06-11T00:00:00.000Z',
    id: 'delivery-1',
    provider: 'FCM',
    response,
    status: 'FAILED',
  };
}

import {
  notificationDeliveryFailureCode,
  notificationDeliveryFailureReason,
  notificationDeliveryRecoveryHint,
  type NotificationDelivery,
} from './notification-delivery-response';

describe('notification delivery response helpers', () => {
  it('reads current push processor failure details', () => {
    const delivery = deliveryResponse({
      failureCode: 'messaging/registration-token-not-registered',
      reason: 'registration token [masked]',
    });

    expect(notificationDeliveryFailureCode(delivery)).toBe('messaging/registration-token-not-registered');
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

  it('maps known FCM failure codes to operator recovery hints', () => {
    expect(
      notificationDeliveryRecoveryHint(deliveryResponse({ failureCode: 'messaging/mismatched-credential' })),
    ).toBe(
      'Install Firebase Admin SDK JSON from the same Firebase project as the mobile app configs before retrying.',
    );
    expect(
      notificationDeliveryRecoveryHint(
        deliveryResponse({ failureCode: 'messaging/registration-token-not-registered' }),
      ),
    ).toBe('Ask the user to reopen the app so it can register a fresh FCM token before retrying.');
    expect(notificationDeliveryRecoveryHint(deliveryResponse({ failureCode: 'unknown' }))).toBeNull();
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

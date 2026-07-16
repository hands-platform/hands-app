import {
  compactNotificationDeliveryResponse,
  notificationDeliveryFailureCode,
} from './notification-delivery-failure';

describe('notification delivery failure helpers', () => {
  it('reads current push processor failure code from delivery response metadata', () => {
    expect(notificationDeliveryFailureCode({ failureCode: 'messaging/mismatched-credential' })).toBe(
      'messaging/mismatched-credential',
    );
  });

  it('reads nested FCM provider failure codes', () => {
    expect(
      notificationDeliveryFailureCode({
        body: {
          error: {
            code: 'INVALID_ARGUMENT',
            details: [{ errorCode: 'BAD_TOKEN' }],
          },
        },
      }),
    ).toBe('BAD_TOKEN');
  });

  it('returns null when no failure code is available', () => {
    expect(notificationDeliveryFailureCode({ name: 'projects/hands/messages/message-1' })).toBeNull();
    expect(notificationDeliveryFailureCode(null)).toBeNull();
  });

  it('keeps only operator-facing failure evidence for notification board rows', () => {
    expect(
      compactNotificationDeliveryResponse({
        body: {
          error: {
            details: [{ errorCode: 'messaging/mismatched-credential' }],
            message: 'Firebase project mismatch',
          },
          providerDebug: 'large internal payload',
        },
        statusCode: 403,
      }),
    ).toEqual({
      failureCode: 'messaging/mismatched-credential',
      reason: 'Firebase project mismatch',
      statusCode: 403,
    });
  });

  it('drops success-only provider payloads from notification board rows', () => {
    expect(
      compactNotificationDeliveryResponse({
        messageId: 'projects/hands/messages/message-1',
        providerDebug: { trace: 'large internal payload' },
      }),
    ).toBeNull();
    expect(compactNotificationDeliveryResponse(null)).toBeNull();
  });
});

import { notificationDeliveryFailureCode } from './notification-delivery-failure';

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
});

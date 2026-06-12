import {
  firebaseFailureCode,
  isPermanentTokenFailure,
  maskSensitivePushToken,
  safeErrorMessage,
} from './push-delivery-error';

describe('push delivery error helpers', () => {
  it('extracts Firebase failure codes with a stable fallback', () => {
    expect(firebaseFailureCode({ code: 'messaging/invalid-registration-token' })).toBe(
      'messaging/invalid-registration-token',
    );
    expect(firebaseFailureCode(new Error('network'))).toBe('FCM_DELIVERY_FAILED');
  });

  it('classifies permanent token failures', () => {
    expect(isPermanentTokenFailure('messaging/registration-token-not-registered')).toBe(true);
    expect(isPermanentTokenFailure('messaging/invalid-registration-token')).toBe(true);
    expect(isPermanentTokenFailure('UNREGISTERED')).toBe(true);
    expect(isPermanentTokenFailure('INVALID_ARGUMENT')).toBe(false);
    expect(isPermanentTokenFailure('messaging/internal-error')).toBe(false);
  });

  it('masks raw push tokens from error messages', () => {
    const token = 'fcm-demo-token';
    const error = new Error(
      'Requested entity was not found: registration token: fcm-demo-token. Raw token fcm-demo-token rejected.',
    );

    expect(safeErrorMessage(error, token)).toBe(
      'Requested entity was not found: registration token [masked]. Raw token [masked] rejected.',
    );
    expect(safeErrorMessage('unknown', token)).toBe('Unknown FCM delivery error.');
    expect(maskSensitivePushToken(`token ${token}`, token)).toBe('token [masked]');
  });
});

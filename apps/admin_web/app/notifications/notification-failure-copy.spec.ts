import {
  notificationFailureCodeLabel,
  notificationFailureRecoveryActionLabel,
  notificationFailureRecoveryHint,
} from './notification-failure-copy';

describe('notification failure copy', () => {
  it('turns known FCM failure codes into operator labels', () => {
    expect(notificationFailureCodeLabel('messaging/mismatched-credential')).toBe(
      'Firebase project mismatch',
    );
    expect(notificationFailureCodeLabel('messaging/registration-token-not-registered')).toBe(
      'FCM token needs refresh',
    );
    expect(notificationFailureCodeLabel('messaging/internal-error')).toBe(
      'Firebase temporary service error',
    );
    expect(notificationFailureCodeLabel('messaging/server-unavailable')).toBe(
      'Firebase temporarily unavailable',
    );
  });

  it('keeps retry guidance for temporary Firebase service failures', () => {
    expect(notificationFailureRecoveryHint('messaging/internal-error')).toBe(
      'Retry after Firebase service status and local delivery workers are confirmed.',
    );
    expect(notificationFailureRecoveryActionLabel('messaging/server-unavailable')).toBe(
      'Next retry after Firebase status check',
    );
  });
});

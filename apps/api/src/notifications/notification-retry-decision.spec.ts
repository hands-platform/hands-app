import { describe, expect, it } from 'vitest';

import {
  NOTIFICATION_RETRY_COOLDOWN_MS,
  notificationRetryDecision,
} from './notification-retry-decision';

const now = new Date('2026-08-10T12:00:00.000Z');
const device = {
  createdAt: '2026-08-01T00:00:00.000Z',
  id: 'device-1',
  updatedAt: '2026-08-01T00:00:00.000Z',
};

function failure(code: string, attemptedAt = '2026-08-10T11:00:00.000Z') {
  return {
    attemptedAt,
    pushDeviceId: device.id,
    response: { failureCode: code },
    status: 'FAILED',
  };
}

describe('notificationRetryDecision', () => {
  it('blocks permanent payload and provider configuration failures', () => {
    expect(notificationRetryDecision([device], [failure('INVALID_ARGUMENT')], now)).toMatchObject({
      failureClass: 'payload-config',
      state: 'blocked',
    });
    expect(notificationRetryDecision([device], [failure('PUSH_PROVIDER_NOT_CONFIGURED')], now)).toMatchObject({
      failureClass: 'payload-config',
      state: 'blocked',
    });
  });

  it('requires a refreshed route after a token failure', () => {
    const delivery = failure('messaging/registration-token-not-registered');
    expect(notificationRetryDecision([device], [delivery], now).state).toBe('blocked');
    expect(notificationRetryDecision(
      [{ ...device, updatedAt: '2026-08-10T11:30:00.000Z' }],
      [delivery],
      now,
    )).toMatchObject({ failureClass: 'route-recovery', state: 'allowed' });
  });

  it('keeps a transient failure conditional during cooldown and allows it afterward', () => {
    const attemptedAt = new Date(now.getTime() - NOTIFICATION_RETRY_COOLDOWN_MS + 1_000).toISOString();
    expect(notificationRetryDecision([device], [failure('messaging/server-unavailable', attemptedAt)], now)).toMatchObject({
      failureClass: 'transient',
      state: 'conditional',
    });
    expect(notificationRetryDecision([device], [failure('messaging/server-unavailable')], now)).toMatchObject({
      failureClass: 'transient',
      state: 'allowed',
    });
    expect(notificationRetryDecision([device], [failure('FCM_DELIVERY_UNAVAILABLE')], now)).toMatchObject({
      failureClass: 'transient',
      state: 'allowed',
    });
    expect(notificationRetryDecision([device], [failure('HTTP_503')], now)).toMatchObject({
      failureClass: 'transient',
      state: 'allowed',
    });
  });

  it('blocks unknown failures and excludes already accepted paths', () => {
    expect(notificationRetryDecision([device], [failure('SOMETHING_NEW')], now).state).toBe('blocked');
    for (const status of ['SENT', 'DELIVERED', 'SUCCESS']) {
      expect(notificationRetryDecision([device], [{ ...failure(''), status }], now).reason)
        .toContain('No eligible unresolved push path');
    }
  });
});

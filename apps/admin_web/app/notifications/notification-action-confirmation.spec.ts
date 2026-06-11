import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationActionConfirmation,
  enablePushDeviceConfirmHref,
  readNotificationConfirmationAction,
  retryNotificationConfirmHref,
} from './notification-action-confirmation';

const notification = {
  id: 'notification-row-123456',
  type: 'booking.requested',
  title: 'Partner request',
  body: 'A booking request is available.',
  createdAt: '2026-06-01T00:00:00.000Z',
  deliveries: [
    {
      id: 'delivery-1',
      provider: 'FCM',
      status: 'FAILED',
      attemptedAt: '2026-06-01T00:01:00.000Z',
      pushDevice: {
        id: 'push-device-123456',
        platform: 'ios',
        enabled: false,
      },
    },
  ],
} as AdminNotification;

describe('notification action confirmation', () => {
  it('builds a retry confirmation for a loaded notification', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      notificationId: notification.id,
      pushDeviceId: '',
    });

    expect(confirmation).toEqual({
      action: 'retry',
      cancelHref: '/notifications',
      confirmLabel: 'Retry notification',
      description:
        'Retry notification notifica after reviewing delivery failures, token health, and duplicate-send risk.',
      hiddenInputs: [{ name: 'notificationId', value: notification.id }],
      id: notification.id,
      title: 'Retry notification notifica?',
      tone: 'warning',
    });
  });

  it('builds an enable device confirmation for a disabled push device', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'enable-device', {
      notificationId: '',
      pushDeviceId: 'push-device-123456',
    });

    expect(confirmation).toEqual({
      action: 'enable-device',
      cancelHref: '/notifications',
      confirmLabel: 'Re-enable device',
      description:
        'Re-enable ios push device push-dev only after a fresh token or operator confirmation exists.',
      hiddenInputs: [{ name: 'pushDeviceId', value: 'push-device-123456' }],
      id: 'push-device-123456',
      title: 'Re-enable device push-dev?',
      tone: 'danger',
    });
  });

  it('returns null when the requested notification or device is not loaded', () => {
    expect(
      buildNotificationActionConfirmation([notification], 'retry', {
        notificationId: 'missing',
        pushDeviceId: '',
      }),
    ).toBeNull();
    expect(
      buildNotificationActionConfirmation([notification], 'enable-device', {
        notificationId: '',
        pushDeviceId: 'missing',
      }),
    ).toBeNull();
  });

  it('reads only supported confirmation actions', () => {
    expect(readNotificationConfirmationAction('retry')).toBe('retry');
    expect(readNotificationConfirmationAction('enable-device')).toBe('enable-device');
    expect(readNotificationConfirmationAction('delete')).toBeNull();
  });

  it('encodes confirmation URLs', () => {
    expect(retryNotificationConfirmHref('notification 1')).toBe(
      '/notifications?confirm=retry&notificationId=notification%201',
    );
    expect(enablePushDeviceConfirmHref('device 1')).toBe(
      '/notifications?confirm=enable-device&pushDeviceId=device%201',
    );
  });
});

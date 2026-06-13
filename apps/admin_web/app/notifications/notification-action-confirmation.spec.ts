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
        'Retry notification notifica after reviewing duplicate-send risk. Latest evidence: FCM FAILED; platform ios; attempted 1 Jun 2026, 07:01; device disabled; token timestamp unknown.',
      hiddenInputs: [
        { name: 'notificationId', value: notification.id },
        { name: 'returnHref', value: '/notifications' },
      ],
      id: notification.id,
      supportingLinks: [
        {
          description: 'Open retry, delivery, and device recovery audit events before resending.',
          href: '/audit-log?bucket=Notification&q=notification-row-123456&range=all',
          label: 'Audit trail',
        },
      ],
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
        'Re-enable ios push device push-dev only after a fresh token or operator confirmation exists. Latest evidence: FCM FAILED; platform ios; attempted 1 Jun 2026, 07:01; device disabled; token timestamp unknown.',
      hiddenInputs: [
        { name: 'pushDeviceId', value: 'push-device-123456' },
        { name: 'returnHref', value: '/notifications' },
      ],
      id: 'push-device-123456',
      title: 'Re-enable device push-dev?',
      tone: 'danger',
    });
  });

  it('warns operators when retrying a notification with no delivery attempt yet', () => {
    const pendingNotification = { ...notification, deliveries: [] };
    const confirmation = buildNotificationActionConfirmation([pendingNotification], 'retry', {
      notificationId: pendingNotification.id,
      pushDeviceId: '',
    });

    expect(confirmation?.description).toBe(
      'Retry notification notifica after reviewing duplicate-send risk. No delivery attempt is captured yet; confirm workers before retrying.',
    );
  });

  it('uses the newest delivery attempt as retry evidence', () => {
    const confirmation = buildNotificationActionConfirmation(
      [
        {
          ...notification,
          deliveries: [
            {
              ...notification.deliveries?.[0],
              attemptedAt: '2026-06-01T00:01:00.000Z',
              id: 'delivery-old',
              provider: 'FCM',
              status: 'FAILED',
            },
            {
              ...notification.deliveries?.[0],
              attemptedAt: '2026-06-01T00:04:00.000Z',
              id: 'delivery-new',
              provider: 'FCM',
              response: { failureCode: 'messaging/mismatched-credential' },
              status: 'FAILED',
            },
          ],
        },
      ],
      'retry',
      {
        notificationId: notification.id,
        pushDeviceId: '',
      },
    );

    expect(confirmation?.description).toContain('attempted 1 Jun 2026, 07:04');
    expect(confirmation?.description).toContain('failure messaging/mismatched-credential');
    expect(confirmation?.description).toContain(
      'next Install Firebase Admin SDK JSON from the same Firebase project as the mobile app configs before retrying.',
    );
  });

  it('makes retry copy explicit when the latest delivery already succeeded', () => {
    const confirmation = buildNotificationActionConfirmation(
      [
        {
          ...notification,
          deliveries: [
            {
              ...notification.deliveries?.[0],
              attemptedAt: '2026-06-01T00:01:00.000Z',
              id: 'delivery-old-failed',
              provider: 'FCM',
              status: 'FAILED',
            },
            {
              ...notification.deliveries?.[0],
              attemptedAt: '2026-06-01T00:04:00.000Z',
              id: 'delivery-new-sent',
              provider: 'FCM',
              status: 'SENT',
              pushDevice: {
                id: 'push-device-123456',
                platform: 'android',
                enabled: true,
              },
            },
          ],
        },
      ],
      'retry',
      {
        notificationId: notification.id,
        pushDeviceId: '',
      },
    );

    expect(confirmation).toMatchObject({
      confirmLabel: 'Retry anyway',
      supportingLinks: [
        {
          description: 'Open retry, delivery, and device recovery audit events before resending.',
          href: '/audit-log?bucket=Notification&q=notification-row-123456&range=all',
          label: 'Audit trail',
        },
      ],
      tone: 'info',
    });
    expect(confirmation?.description).toBe(
      'Notification notifica already has a successful latest delivery. Retry only if support confirmed the user still missed it. Latest evidence: FCM SENT; platform android; attempted 1 Jun 2026, 07:04; device enabled; token timestamp unknown.',
    );
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

  it('preserves active queue context in confirmation URLs and cancel links', () => {
    expect(
      retryNotificationConfirmHref('notification 1', {
        booking: 'booking 1',
        review: 'failed',
      }),
    ).toBe('/notifications?review=failed&booking=booking%201&confirm=retry&notificationId=notification%201');
    expect(
      enablePushDeviceConfirmHref('device 1', {
        booking: 'booking 1',
        review: 'disabled-device',
      }),
    ).toBe(
      '/notifications?review=disabled-device&booking=booking%201&confirm=enable-device&pushDeviceId=device%201',
    );

    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      booking: 'booking 1',
      notificationId: notification.id,
      pushDeviceId: '',
      review: 'failed',
    });

    expect(confirmation?.cancelHref).toBe('/notifications?review=failed&booking=booking%201');
    expect(confirmation?.hiddenInputs).toContainEqual({
      name: 'returnHref',
      value: '/notifications?review=failed&booking=booking%201',
    });
  });
});

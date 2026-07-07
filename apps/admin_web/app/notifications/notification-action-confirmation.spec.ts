import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationActionConfirmation,
  enablePushDeviceConfirmHref,
  filterNotificationActionConfirmationSupportingLinks,
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
      confirmLabel: 'Retry after device recovery',
      description:
        'Notification notifica latest delivery used a disabled push device. Refresh or re-enable the device path before retrying. Latest evidence: FCM FAILED; platform ios; attempted 1 Jun 2026, 07:01; device disabled; token timestamp unknown.',
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
        {
          description: 'Open push device recovery and token change audit events before retrying.',
          href: '/audit-log?bucket=Notification&q=push-device-123456&range=all',
          label: 'Device audit',
        },
      ],
      title: 'Retry notification notifica?',
      tone: 'danger',
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
      supportingLinks: [
        {
          description: 'Open device recovery audit events before re-enabling push delivery.',
          href: '/audit-log?bucket=Notification&q=push-device-123456&range=all',
          label: 'Audit trail',
        },
      ],
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
      'Retry notification notifica only after confirming workers and queue processing. No delivery attempt is captured yet; confirm workers before retrying.',
    );
  });

  it('adds worker path guidance before retrying a pending notification', () => {
    const pendingNotification = { ...notification, deliveries: [] };
    const confirmation = buildNotificationActionConfirmation([pendingNotification], 'retry', {
      notificationId: pendingNotification.id,
      pushDeviceId: '',
      review: 'pending',
    });

    expect(confirmation?.description).toContain(
      'Runbook: Worker path gate. Confirm API workers and delivery processing first; retry only if operations intentionally wants to create a new send attempt.',
    );
    expect(confirmation?.supportingLinks).toEqual([
      {
        description: 'Open retry, delivery, and device recovery audit events before resending.',
        href: '/audit-log?bucket=Notification&q=notification-row-123456&range=all',
        label: 'Audit trail',
      },
    ]);
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
              pushDevice: {
                id: 'push-device-123456',
                platform: 'android',
                enabled: true,
              },
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
    expect(confirmation?.description).toContain('after fixing the latest delivery failure');
    expect(confirmation?.description).toContain('failure messaging/mismatched-credential');
    expect(confirmation?.description).toContain(
      'next Install Firebase Admin SDK JSON from the same Firebase project as the mobile app configs before retrying.',
    );
  });

  it('requires token refresh before retrying a stale FCM delivery', () => {
    const confirmation = buildNotificationActionConfirmation(
      [
        {
          ...notification,
          deliveries: [
            {
              ...notification.deliveries?.[0],
              attemptedAt: '2026-06-01T00:04:00.000Z',
              id: 'delivery-stale-sent',
              provider: 'FCM',
              status: 'SENT',
              pushDevice: {
                id: 'push-device-123456',
                platform: 'android',
                enabled: true,
                lastSeenAt: '2026-04-15T00:04:00.000Z',
              },
            },
          ],
        },
      ],
      'retry',
      {
        notificationId: notification.id,
        pushDeviceId: '',
        review: 'stale-device',
      },
    );

    expect(confirmation).toMatchObject({
      confirmLabel: 'Retry after token refresh',
      tone: 'warning',
    });
    expect(confirmation?.description).toContain(
      'latest delivery used an old FCM token timestamp. Ask the user to reopen the app or complete token recovery before retrying.',
    );
    expect(confirmation?.description).toContain('30+ day token timestamp');
    expect(confirmation?.description).toContain('Runbook: Token freshness gate.');
    expect(confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        {
          description: 'Open push device recovery and token change audit events before retrying.',
          href: '/audit-log?bucket=Notification&q=push-device-123456&range=all',
          label: 'Device audit',
        },
      ]),
    );
  });

  it('prioritizes failed delivery recovery before stale token guidance', () => {
    const confirmation = buildNotificationActionConfirmation(
      [
        {
          ...notification,
          deliveries: [
            {
              ...notification.deliveries?.[0],
              attemptedAt: '2026-06-01T00:04:00.000Z',
              id: 'delivery-stale-failed',
              provider: 'FCM',
              response: { failureCode: 'messaging/mismatched-credential' },
              status: 'FAILED',
              pushDevice: {
                id: 'push-device-123456',
                platform: 'android',
                enabled: true,
                lastSeenAt: '2026-04-15T00:04:00.000Z',
              },
            },
          ],
        },
      ],
      'retry',
      {
        notificationId: notification.id,
        pushDeviceId: '',
        review: 'failed',
      },
    );

    expect(confirmation).toMatchObject({
      confirmLabel: 'Retry notification',
      tone: 'warning',
    });
    expect(confirmation?.description).toContain('after fixing the latest delivery failure');
    expect(confirmation?.description).toContain('failure messaging/mismatched-credential');
    expect(confirmation?.description).toContain('30+ day token timestamp');
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
    expect(confirmation?.description).toContain(
      'Runbook: Retry gate. Open the row delivery evidence and audit trail, fix the blocker, then use Retry only after the delivery path is valid.',
    );
    expect(confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        {
          description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
          href: '/setup#notifications',
          label: 'FCM setup',
        },
      ]),
    );
  });

  it('adds disabled-device runbook guidance before re-enabling a push device', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'enable-device', {
      notificationId: '',
      pushDeviceId: 'push-device-123456',
      review: 'disabled-device',
    });

    expect(confirmation?.description).toContain(
      'Runbook: Device recovery gate. Ask the customer or Partner to reopen the app, complete token recovery when needed, then re-enable only after the token path is current.',
    );
    expect(confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        {
          description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
          href: '/setup#notifications',
          label: 'FCM setup',
        },
      ]),
    );
  });

  it('keeps FCM setup guidance when retrying from the token recovery path', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      notificationId: notification.id,
      pushDeviceId: '',
      review: 'needs-retry',
    });

    expect(confirmation?.description).toContain(
      'Runbook: Recovery decision gate. Resolve the device or credential signal first, then retry from the row action menu with the active queue context preserved.',
    );
    expect(confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        {
          description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
          href: '/setup#notifications',
          label: 'FCM setup',
        },
      ]),
    );
  });

  it('adds FCM route runbook guidance before retrying from the FCM queue', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      notificationId: notification.id,
      pushDeviceId: '',
      review: 'fcm',
    });

    expect(confirmation?.cancelHref).toBe('/notifications?review=fcm');
    expect(confirmation?.description).toContain(
      'Runbook: FCM route gate. Check the live preflight candidate, complete token recovery when app devices changed, then retry only after the notification and device path are valid.',
    );
    expect(confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        {
          description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
          href: '/setup#notifications',
          label: 'FCM setup',
        },
      ]),
    );
  });

  it('filters setup links from confirmation support for ordinary operators', () => {
    const confirmation = buildNotificationActionConfirmation([notification], 'retry', {
      notificationId: notification.id,
      pushDeviceId: '',
      review: 'failed',
    });

    expect(confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/setup#notifications', label: 'FCM setup' }),
      ]),
    );

    const filtered = filterNotificationActionConfirmationSupportingLinks(confirmation, false);
    const unfiltered = filterNotificationActionConfirmationSupportingLinks(confirmation, true);

    expect(filtered?.supportingLinks).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ href: '/setup#notifications', label: 'FCM setup' }),
      ]),
    );
    expect(filtered?.supportingLinks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ href: '/audit-log?bucket=Notification&q=notification-row-123456&range=all' }),
      ]),
    );
    expect(unfiltered?.supportingLinks).toEqual(confirmation?.supportingLinks);
  });
});

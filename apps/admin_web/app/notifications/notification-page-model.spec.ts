import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationChannelSummary,
  buildNotificationDeliveryOpsQueue,
  buildNotificationSummary,
  emptyNotificationMessage,
  filterNotifications,
  notificationFilterDescription,
} from './notification-page-model';

describe('notification page model', () => {
  it('builds notification summary counts from delivery and alert records', () => {
    const summary = buildNotificationSummary(buildNotifications());

    expect(summary).toEqual({
      disabledDevices: 1,
      failed: 1,
      needsRetry: 2,
      noShow: 1,
      payoutSetup: 1,
      sent: 1,
      skipped: 1,
    });
  });

  it('builds delivery operations queue cards from actionable delivery states', () => {
    const queue = buildNotificationDeliveryOpsQueue(buildNotifications());

    expect(queue).toEqual([
      {
        count: 1,
        detail: 'Push provider returned an error. Check failure reason, token freshness, and credentials.',
        href: '/notifications?review=failed',
        key: 'failed',
        label: 'Failed sends',
        tone: 'pill-warn',
      },
      {
        count: 1,
        detail:
          'Re-enable only when the app has registered a fresh token or the operator confirms the device.',
        href: '/notifications?review=disabled-device',
        key: 'disabled-devices',
        label: 'Disabled devices',
        tone: 'pill-warn',
      },
      {
        count: 1,
        detail:
          'Usually means push is intentionally inactive, no enabled device exists, or credentials are pending.',
        href: '/notifications?review=skipped',
        key: 'skipped',
        label: 'Skipped',
        tone: 'pill-info',
      },
      {
        count: 1,
        detail: 'Notification rows exist without delivery attempts. Confirm workers and queue processing.',
        href: '/notifications?review=pending',
        key: 'pending',
        label: 'Pending',
        tone: 'pill-neutral',
      },
    ]);
  });

  it('builds partner alert channel summary from policy and delivery providers', () => {
    const summary = buildNotificationChannelSummary(buildNotifications(), [
      {
        category: 'notifications',
        enforced: true,
        key: 'notification.partner_alert_channel',
        label: 'Partner alert channel',
        options: [
          { label: 'In-app first', tradeoff: 'No OS push by default.', value: 'in_app_first' },
        ],
        value: 'in_app_first',
      },
    ]);

    expect(summary).toEqual({
      inAppDeliveries: 1,
      oneSignalDeliveries: 2,
      partnerAlertCount: 3,
      policyLabel: 'In-app first',
    });
  });

  it('uses an explicit fallback when the partner alert policy is not configured', () => {
    expect(buildNotificationChannelSummary([], []).policyLabel).toBe('Not configured');
  });

  it('filters notifications by review queue and booking id', () => {
    const notifications = [
      notification({
        data: { bookingId: 'booking-1' },
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:00:00.000Z',
            id: 'delivery-failed',
            provider: 'ONESIGNAL',
            status: 'FAILED',
          },
        ],
        id: 'notification-booking-1',
        type: 'booking.requested',
      }),
      notification({
        data: { bookingId: 'booking-2' },
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-sent',
            provider: 'ONESIGNAL',
            status: 'SENT',
          },
        ],
        id: 'notification-booking-2',
        type: 'booking.matched',
      }),
    ];

    const filtered = filterNotifications(notifications, { booking: 'booking-1', review: 'failed' });

    expect(filtered.map((item) => item.id)).toEqual(['notification-booking-1']);
  });

  it('keeps review descriptions and empty table messages stable', () => {
    expect(notificationFilterDescription('failed')).toBe(
      'delivery attempts that returned a push provider failure.',
    );
    expect(notificationFilterDescription('partner-alerts')).toBe('booking and payout alerts sent to partners.');
    expect(notificationFilterDescription('unknown')).toBe('all notification records.');
    expect(emptyNotificationMessage('', undefined, (value) => `short-${value}`)).toBe(
      'No notifications loaded.',
    );
    expect(emptyNotificationMessage('failed', undefined, (value) => `short-${value}`)).toBe(
      'No notifications currently match this queue. delivery attempts that returned a push provider failure.',
    );
    expect(emptyNotificationMessage('failed', 'booking-1', (value) => `short-${value}`)).toBe(
      'No notifications currently match booking short-booking-1. Confirm the booking created an alert row before retrying delivery.',
    );
  });
});

function buildNotifications(): AdminNotification[] {
  return [
    notification({
      deliveries: [
        {
          attemptedAt: '2026-06-01T10:00:00.000Z',
          id: 'delivery-failed',
          provider: 'ONESIGNAL',
          status: 'FAILED',
        },
      ],
      id: 'notification-failed',
      type: 'booking.requested',
    }),
    notification({
      deliveries: [
        {
          attemptedAt: '2026-06-01T10:01:00.000Z',
          id: 'delivery-disabled',
          provider: 'ONESIGNAL',
          pushDevice: { enabled: false, id: 'device-disabled', platform: 'ios' },
          status: 'SENT',
        },
      ],
      id: 'notification-disabled',
      type: 'booking.backup_available',
    }),
    notification({
      deliveries: [
        {
          attemptedAt: '2026-06-01T10:02:00.000Z',
          id: 'delivery-skipped',
          provider: 'IN_APP_ONLY',
          status: 'SKIPPED',
        },
      ],
      id: 'notification-skipped',
      type: 'booking.no_show',
    }),
    notification({
      deliveries: [],
      id: 'notification-pending',
      type: 'provider.payout_setup_required',
    }),
  ];
}

function notification({
  data,
  deliveries,
  id,
  type,
}: {
  readonly data?: unknown;
  readonly deliveries: NonNullable<AdminNotification['deliveries']>;
  readonly id: string;
  readonly type: string;
}): AdminNotification {
  return {
    body: 'Body',
    createdAt: '2026-06-01T09:00:00.000Z',
    data,
    deliveries,
    id,
    title: 'Title',
    type,
  };
}

import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationChannelSummary,
  buildNotificationDeliveryOpsQueue,
  buildNotificationFilters,
  buildNotificationSummary,
  buildNotificationTableRows,
  emptyNotificationMessage,
  filterNotifications,
  notificationFilterDescription,
  notificationFilterLinks,
  sortNotifications,
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
      fcmDeliveries: 2,
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
            provider: 'FCM',
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
            provider: 'FCM',
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

  it('sorts notification rows by delivery urgency before recency', () => {
    const sorted = sortNotifications([
      notification({
        createdAt: '2026-06-01T10:03:00.000Z',
        deliveries: [],
        id: 'pending-newest',
        type: 'booking.requested',
      }),
      notification({
        createdAt: '2026-06-01T10:02:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:02:00.000Z',
            id: 'delivery-sent',
            provider: 'FCM',
            status: 'SENT',
          },
        ],
        id: 'sent',
        type: 'booking.matched',
      }),
      notification({
        createdAt: '2026-06-01T10:01:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-failed',
            provider: 'FCM',
            status: 'FAILED',
          },
        ],
        id: 'failed',
        type: 'booking.requested',
      }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(['failed', 'sent', 'pending-newest']);
  });

  it('builds table rows with action links, partner labels, and delivery evidence', () => {
    const rows = buildNotificationTableRows([
      notification({
        data: {
          backupOpenMode: 'parallel_marketplace',
          backupProviderRadiusMeters: 2500,
          bookingId: 'booking-123456',
          distanceMeters: 400,
          providerProfileId: 'partner-987654',
        },
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-disabled',
            provider: 'FCM',
            pushDevice: {
              enabled: false,
              id: 'device-disabled',
              lastSeenAt: '2026-06-01T10:02:00.000Z',
              platform: 'ios',
            },
            response: { body: { error: { details: [{ errorCode: 'BAD_TOKEN' }] } }, statusCode: 400 },
            status: 'FAILED',
          },
        ],
        id: 'notification-row',
        type: 'booking.backup_available',
        user: {
          fullName: 'Mai Partner',
          phone: '+8490',
          providerProfile: { displayName: 'Mai', id: 'partner-987654', status: 'APPROVED' },
        },
      }),
    ]);

    expect(rows[0]).toMatchObject({
      actionLabel: 'Notification actions for notifica',
      bookingDataHint:
        'booking booking- / partner partner- / distance 400 m / marketplace radius 2.5 km / marketplace mode parallel_marketplace',
      opsSignal: 'Retry needed',
      partnerHref: '/partners/partner-987654',
      partnerLabel: 'Partner Mai',
      typeLabel: 'Booking Marketplace Available',
    });
    expect(rows[0]?.actions.map((action) => action.label)).toEqual(['Open booking', 'Open Partner', 'Retry']);
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      deviceLastSeenAtLabel: '1 Jun 2026, 17:02',
      deviceStateLabel: 'Device disabled',
      enableDeviceHref: '/notifications?confirm=enable-device&pushDeviceId=device-disabled',
      failureCodeLabel: 'BAD_TOKEN',
      httpStatusLabel: '400',
    });
  });

  it('reads current push processor failure details from delivery response metadata', () => {
    const rows = buildNotificationTableRows([
      notification({
        data: { chatRoomId: 'chat-1' },
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-failed-token',
            provider: 'FCM',
            response: {
              failureCode: 'messaging/registration-token-not-registered',
              reason: 'registration token [masked]',
            },
            status: 'FAILED',
          },
        ],
        id: 'notification-failed-token',
        type: 'chat.message.created',
      }),
    ]);

    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      failureCodeLabel: 'messaging/registration-token-not-registered',
      failureReasonLabel: 'registration token [masked]',
      provider: 'FCM',
      status: 'FAILED',
    });
  });

  it('treats payout batch updates as partner alerts without exposing payout metadata', () => {
    const notifications = [
      notification({
        data: { payoutBatchId: 'payout-batch-123456', providerProfileId: 'partner-987654' },
        deliveries: [],
        id: 'notification-payout-batch',
        type: 'provider.payout_batch.updated',
        user: {
          fullName: 'Mai Partner',
          phone: '+8490',
          providerProfile: { displayName: 'Mai', id: 'partner-987654', status: 'APPROVED' },
        },
      }),
    ];

    expect(filterNotifications(notifications, { booking: '', review: 'partner-alerts' })).toHaveLength(1);
    expect(buildNotificationChannelSummary(notifications, []).partnerAlertCount).toBe(1);
    expect(buildNotificationTableRows(notifications)[0]).toMatchObject({
      bookingDataHint: 'partner partner- / payout batch payout-b',
      typeMeaning: 'Partner payout batch lifecycle alert',
    });
  });

  it('keeps review descriptions and empty table messages stable', () => {
    expect(buildNotificationFilters({ booking: 'booking-1', review: 'failed' })).toEqual({
      booking: 'booking-1',
      review: 'failed',
    });
    expect(notificationFilterLinks.find((item) => item.review === 'partner-alerts')).toEqual({
      href: '/notifications?review=partner-alerts',
      label: 'Partner alerts',
      review: 'partner-alerts',
    });
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
          provider: 'FCM',
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
          provider: 'FCM',
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
  createdAt,
  data,
  deliveries,
  id,
  type,
  user,
}: {
  readonly createdAt?: string;
  readonly data?: unknown;
  readonly deliveries: NonNullable<AdminNotification['deliveries']>;
  readonly id: string;
  readonly type: string;
  readonly user?: AdminNotification['user'];
}): AdminNotification {
  return {
    body: 'Body',
    createdAt: createdAt ?? '2026-06-01T09:00:00.000Z',
    data,
    deliveries,
    id,
    title: 'Title',
    type,
    user,
  };
}

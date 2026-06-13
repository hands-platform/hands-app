import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationChannelSummary,
  buildNotificationDeliveryStats,
  buildNotificationDeliveryOpsQueue,
  buildNotificationFilters,
  buildNotificationPageModel,
  buildNotificationPartnerAlertSmokeFallback,
  buildNotificationSummary,
  buildNotificationTableRows,
  emptyNotificationMessage,
  filterNotifications,
  isStalePushDeviceDelivery,
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
      pending: 1,
      sent: 2,
      skipped: 1,
      staleDevices: 1,
    });
  });

  it('builds reusable delivery stats for summary and operations queue models', () => {
    expect(buildNotificationDeliveryStats(buildNotifications())).toEqual({
      disabledDevices: 1,
      failedDeliveries: 1,
      failedNotifications: 1,
      pendingNotifications: 1,
      sentDeliveries: 2,
      skippedDeliveries: 1,
      skippedNotifications: 1,
      stalePushDeviceDeliveries: 1,
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
          'Push token timestamp is 30+ days old at delivery attempt. Confirm the app has refreshed its FCM token before retrying.',
        href: '/notifications?review=stale-device',
        key: 'stale-devices',
        label: 'Stale devices',
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

  it('keeps the delivery operations queue empty when there are no blockers', () => {
    expect(buildNotificationDeliveryOpsQueue([])).toEqual([]);
  });

  it('builds partner alert routing summary from policy and delivery providers', () => {
    const summary = buildNotificationChannelSummary(buildNotifications(), [
      {
        category: 'notifications',
        enforced: true,
        key: 'notification.partner_alert_channel',
        label: 'Partner alert routing',
        options: [{ label: 'In-app first', tradeoff: 'No FCM push by default.', value: 'in_app_first' }],
        value: 'in_app_first',
      },
    ]);

    expect(summary).toEqual({
      inAppDeliveries: 1,
      fcmDeliveries: 3,
      partnerAlertCount: 4,
      policyLabel: 'In-app first',
    });
  });

  it('uses an explicit fallback when the partner alert policy is not configured', () => {
    expect(buildNotificationChannelSummary([], []).policyLabel).toBe('Not configured');
  });

  it('maps the deprecated partner alert push value to FCM-facing Admin copy', () => {
    const summary = buildNotificationChannelSummary(
      [],
      [
        {
          category: 'notifications',
          enforced: true,
          key: 'notification.partner_alert_channel',
          label: 'Partner alert routing',
          value: 'ONESIGNAL_FOR_ALL_BOOKINGS',
        },
      ],
    );

    expect(summary.policyLabel).toBe('FCM for all bookings (legacy saved value)');
  });

  it('suggests a same-provider non partner-alert notification for FCM smoke fallback', () => {
    const fallback = buildNotificationPartnerAlertSmokeFallback(
      [
        notification({
          createdAt: '2026-06-01T10:00:00.000Z',
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:01:00.000Z',
              id: 'delivery-in-app',
              provider: 'IN_APP_ONLY',
              status: 'SKIPPED',
            },
          ],
          id: 'notification-partner-alert',
          type: 'provider.payout_batch.updated',
          user: providerUser('provider-user-1'),
        }),
        notification({
          createdAt: '2026-06-01T09:59:00.000Z',
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:02:00.000Z',
              id: 'delivery-fcm',
              provider: 'FCM',
              pushDevice: { enabled: true, id: 'device-provider', platform: 'android' },
              status: 'SENT',
            },
          ],
          id: 'notification-earning',
          type: 'earning.created',
          user: providerUser('provider-user-1'),
        }),
      ],
      [
        {
          category: 'notifications',
          enforced: true,
          key: 'notification.partner_alert_channel',
          label: 'Partner alert routing',
          value: 'IN_APP_WITH_PUSH_LATER',
        },
      ],
    );

    expect(fallback).toEqual({
      detail: 'Use FCM_SMOKE_NOTIFICATION_ID=notification-earning for the same role/phone smoke preflight.',
      partnerAlertNotificationId: 'notification-partner-alert',
      partnerAlertType: 'provider.payout_batch.updated',
      preflightCommand:
        '$env:FCM_SMOKE_ROLE="PROVIDER"; $env:FCM_SMOKE_PHONE="+84900000002"; $env:FCM_SMOKE_PLATFORM="android"; $env:FCM_SMOKE_USE_REGISTERED_DEVICE="true"; $env:FCM_SMOKE_EXPECT_PROVIDER="FCM"; $env:FCM_SMOKE_EXPECT_STATUS="SENT"; $env:FCM_SMOKE_NOTIFICATION_ID="notification-earning"; npm.cmd run fcm:push-smoke -- --preflight',
      suggestedNotificationId: 'notification-earning',
      suggestedType: 'earning.created',
    });
  });

  it('does not suggest a partner-alert fallback when policy already routes partner alerts to FCM', () => {
    expect(
      buildNotificationPartnerAlertSmokeFallback(
        [
          notification({
            deliveries: [
              {
                attemptedAt: '2026-06-01T10:01:00.000Z',
                id: 'delivery-in-app',
                provider: 'IN_APP_ONLY',
                status: 'SKIPPED',
              },
            ],
            id: 'notification-partner-alert',
            type: 'provider.payout_batch.updated',
            user: providerUser('provider-user-1'),
          }),
        ],
        [
          {
            category: 'notifications',
            enforced: true,
            key: 'notification.partner_alert_channel',
            label: 'Partner alert routing',
            value: 'FCM_FOR_ALL_BOOKINGS',
          },
        ],
      ),
    ).toBeNull();
  });

  it('keeps Partner-facing fallback copy when no non partner-alert smoke candidate exists', () => {
    const fallback = buildNotificationPartnerAlertSmokeFallback(
      [
        notification({
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:01:00.000Z',
              id: 'delivery-in-app',
              provider: 'IN_APP_ONLY',
              status: 'SKIPPED',
            },
          ],
          id: 'notification-partner-alert',
          type: 'provider.payout_batch.updated',
          user: providerUser('provider-user-1'),
        }),
      ],
      [],
    );

    expect(fallback).toMatchObject({
      detail:
        'Create or select a non partner-alert notification for the same Partner before expecting FCM smoke to pass.',
      preflightCommand: null,
      suggestedNotificationId: null,
    });
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

  it('builds the page model with filtered rows and confirmation state', () => {
    const model = buildNotificationPageModel({
      notifications: [
        notification({
          data: { bookingId: 'booking-1' },
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:01:00.000Z',
              id: 'delivery-failed',
              provider: 'FCM',
              status: 'FAILED',
            },
          ],
          id: 'notification-failed',
          type: 'booking.requested',
        }),
        notification({
          data: { bookingId: 'booking-2' },
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:02:00.000Z',
              id: 'delivery-sent',
              provider: 'FCM',
              status: 'SENT',
            },
          ],
          id: 'notification-sent',
          type: 'booking.matched',
        }),
      ],
      operationalPolicies: [],
      params: {
        confirm: 'retry',
        notificationId: 'notification-failed',
        review: 'failed',
      },
    });

    expect(model.activeFilter?.label).toBe('Failed sends');
    expect(model.confirmation?.action).toBe('retry');
    expect(model.metrics.map((metric) => [metric.label, metric.value])).toEqual([
      ['Total', 2],
      ['Needs retry', 1],
      ['Sent', 1],
      ['Skipped', 0],
      ['Pending', 0],
      ['Failed', 1],
      ['Disabled devices', 0],
      ['Stale devices', 0],
      ['Payout setup', 0],
      ['Partner alerts', 2],
      ['No-show alerts', 0],
      ['FCM route', 2],
    ]);
    expect(model.notifications.map((item) => item.id)).toEqual(['notification-failed']);
    expect(model.notificationRows.map((row) => row.id)).toEqual(['notification-failed']);
    expect(model.summary).toMatchObject({ failed: 1, sent: 1 });
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
      deviceFreshnessLabel: 'Token timestamp current',
      deviceLastSeenAtLabel: '1 Jun 2026, 17:02',
      deviceStateLabel: 'Device disabled',
      enableDeviceHref: '/notifications?confirm=enable-device&pushDeviceId=device-disabled',
      failureCodeLabel: 'BAD_TOKEN',
      httpStatusLabel: '400',
      statusClassName: 'pill pill-warn',
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
      statusClassName: 'pill pill-warn',
    });
  });

  it('orders delivery rows by newest attempt first for compact table summaries', () => {
    const rows = buildNotificationTableRows([
      notification({
        data: { bookingId: 'booking-1' },
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-old',
            provider: 'FCM',
            status: 'FAILED',
          },
          {
            attemptedAt: '2026-06-01T10:03:00.000Z',
            id: 'delivery-new',
            provider: 'FCM',
            status: 'SENT',
          },
        ],
        id: 'notification-delivery-order',
        type: 'booking.requested',
      }),
    ]);

    expect(rows[0]?.deliveryRows.map((delivery) => delivery.id)).toEqual(['delivery-new', 'delivery-old']);
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      status: 'SENT',
      statusClassName: 'pill pill-success',
    });
  });

  it('marks stale push token deliveries as an operator warning even when FCM accepted the send', () => {
    const rows = buildNotificationTableRows([
      notification({
        data: { bookingId: 'booking-1' },
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-stale',
            provider: 'FCM',
            pushDevice: {
              enabled: true,
              id: 'device-stale',
              lastSeenAt: '2026-04-15T10:01:00.000Z',
              platform: 'android',
            },
            status: 'SENT',
          },
        ],
        id: 'notification-stale',
        type: 'booking.matched',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      opsSignal: 'Stale device',
      signalClassName: 'signal signal-warn',
    });
    expect(rows[0]?.opsHint).toContain('Push token timestamp is old');
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      deviceFreshnessLabel: '30+ day token timestamp',
      deviceStateLabel: 'Device enabled',
      status: 'SENT',
      statusClassName: 'pill pill-success',
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
    expect(notificationFilterLinks.find((item) => item.review === 'stale-device')).toEqual({
      href: '/notifications?review=stale-device',
      label: 'Stale devices',
      review: 'stale-device',
    });
    expect(notificationFilterDescription('failed')).toBe(
      'delivery attempts that returned a push provider failure.',
    );
    expect(notificationFilterDescription('partner-alerts')).toBe(
      'booking and payout alerts sent to partners.',
    );
    expect(notificationFilterDescription('stale-device')).toBe(
      'delivery attempts made with old push token timestamps.',
    );
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

  it('detects stale push token timestamps without double-counting disabled devices', () => {
    expect(
      isStalePushDeviceDelivery({
        attemptedAt: '2026-06-01T10:00:00.000Z',
        id: 'delivery-stale',
        provider: 'FCM',
        pushDevice: {
          enabled: true,
          id: 'device-stale',
          lastSeenAt: '2026-04-15T10:00:00.000Z',
          platform: 'android',
        },
        status: 'SENT',
      }),
    ).toBe(true);
    expect(
      isStalePushDeviceDelivery({
        attemptedAt: '2026-06-01T10:00:00.000Z',
        id: 'delivery-disabled',
        provider: 'FCM',
        pushDevice: {
          enabled: false,
          id: 'device-disabled',
          lastSeenAt: '2026-04-15T10:00:00.000Z',
          platform: 'android',
        },
        status: 'FAILED',
      }),
    ).toBe(false);
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
      deliveries: [
        {
          attemptedAt: '2026-06-01T10:03:00.000Z',
          id: 'delivery-stale',
          provider: 'FCM',
          pushDevice: {
            enabled: true,
            id: 'device-stale',
            lastSeenAt: '2026-04-15T10:03:00.000Z',
            platform: 'android',
          },
          status: 'SENT',
        },
      ],
      id: 'notification-stale',
      type: 'booking.matched',
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

function providerUser(id: string): NonNullable<AdminNotification['user']> {
  return {
    id,
    phone: '+84900000002',
    roles: ['PROVIDER'],
    providerProfile: { id: 'provider-profile-1', status: 'APPROVED' },
  };
}

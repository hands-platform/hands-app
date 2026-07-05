import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationApiHref,
  buildNotificationSummaryApiHref,
  buildNotificationChannelSummary,
  buildNotificationDeliveryStats,
  buildNotificationDeliveryOpsQueue,
  buildNotificationFilters,
  buildNotificationFcmSmokeReadiness,
  buildNotificationListHref,
  buildNotificationPageModel,
  buildNotificationPartnerAlertSmokeFallback,
  buildNotificationPolicyApiHref,
  buildNotificationReviewState,
  buildNotificationSummary,
  buildNotificationTableRows,
  emptyNotificationMessage,
  filterNotifications,
  isStalePushDeviceDelivery,
  notificationFilterDescription,
  notificationFilterLinks,
  notificationDateRangeLabel,
  notificationDateRangeLinks,
  notificationReviewRunbook,
  sortNotifications,
} from './notification-page-model';
import { buildFcmPushSmokeCommand } from './fcm-smoke-commands';

describe('notification page model', () => {
  it('builds notification summary counts from delivery and alert records', () => {
    const summary = buildNotificationSummary(buildNotifications());

    expect(summary).toEqual({
      disabledDevices: 1,
      failed: 1,
      needsRetry: 3,
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
      retrySignalNotifications: 3,
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
        detail:
          'Latest push attempt returned an error. Check failure reason, token freshness, and credentials.',
        href: '/notifications?review=failed',
        key: 'failed',
        label: 'Failed sends',
        tone: 'warning',
      },
      {
        count: 1,
        detail:
          'Re-enable only when the app has registered a fresh token or the operator confirms the device.',
        href: '/notifications?review=disabled-device',
        key: 'disabled-devices',
        label: 'Disabled devices',
        tone: 'warning',
      },
      {
        count: 1,
        detail:
          'Push token timestamp is 30+ days old at delivery attempt. Confirm the app has refreshed its FCM token before retrying.',
        href: '/notifications?review=stale-device',
        key: 'stale-devices',
        label: 'Stale devices',
        tone: 'warning',
      },
      {
        count: 1,
        detail:
          'Usually means push is intentionally inactive, no enabled device exists, or credentials are pending.',
        href: '/notifications?review=skipped',
        key: 'skipped',
        label: 'Skipped',
        tone: 'info',
      },
      {
        count: 1,
        detail: 'Notification rows exist without delivery attempts. Confirm workers and queue processing.',
        href: '/notifications?review=pending',
        key: 'pending',
        label: 'Pending',
        tone: 'neutral',
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
      latestFcmSentAttemptLabel: '1 Jun 2026, 17:03',
      latestFcmSentDetail: 'Customer No phone on file / android / Booking Matched notifica / device device-s',
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

  it('suggests a same-provider standard notification for FCM smoke fallback', () => {
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
      detail:
        'Use FCM_SMOKE_NOTIFICATION_ID=notification-earning for the same Partner/phone FCM smoke preflight.',
      partnerAlertNotificationId: 'notification-partner-alert',
      partnerAlertType: 'provider.payout_batch.updated',
      partnerAlertTypeLabel: 'Partner Payout Batch Updated',
      preflightCommand: buildFcmPushSmokeCommand({
        notificationId: 'notification-earning',
        phone: '+84900000002',
        platform: 'android',
        preflight: true,
        role: 'PROVIDER',
        useRegisteredDevice: true,
      }),
      suggestedNotificationId: 'notification-earning',
      suggestedType: 'earning.created',
    });
  });

  it('does not use deferred payment notifications for partner alert FCM smoke fallback', () => {
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
          createdAt: '2026-06-01T10:02:00.000Z',
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:03:00.000Z',
              id: 'delivery-payment',
              provider: 'FCM',
              pushDevice: { enabled: true, id: 'device-provider', platform: 'android' },
              status: 'SENT',
            },
          ],
          id: 'notification-payment',
          type: 'payment.updated',
          user: providerUser('provider-user-1'),
        }),
      ],
      [],
    );

    expect(fallback).toMatchObject({
      preflightCommand: null,
      suggestedNotificationId: null,
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

  it('keeps Partner-facing fallback copy when no standard smoke candidate exists', () => {
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
        'Create or select a standard notification for the same Partner before expecting FCM smoke to pass.',
      preflightCommand: null,
      suggestedNotificationId: null,
    });
  });

  it('builds an FCM registered-device preflight candidate from the newest enabled delivery', () => {
    const readiness = buildNotificationFcmSmokeReadiness([
      notification({
        createdAt: '2026-06-01T10:00:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-old',
            provider: 'FCM',
            pushDevice: { enabled: true, id: 'device-old', platform: 'ios', role: 'CUSTOMER' },
            status: 'SENT',
          },
        ],
        id: 'notification-old',
        type: 'payment.updated',
        user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
      }),
      notification({
        createdAt: '2026-06-01T10:04:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:05:00.000Z',
            id: 'delivery-new',
            provider: 'FCM',
            pushDevice: { enabled: true, id: 'device-new', platform: 'android', role: 'PROVIDER' },
            status: 'SENT',
          },
        ],
        id: 'notification-new',
        type: 'earning.created',
        user: providerUser('provider-user-1'),
      }),
    ]);

    expect(readiness).toMatchObject({
      detail: 'Partner +84900000002 can reuse the enabled android device for preflight without sending FCM.',
      latestAttemptLabel: '1 Jun 2026, 17:05',
      pushDeviceLabel: 'android device-n',
      selectedNotificationId: 'notification-new',
      selectedNotificationLabel: 'Earning Created notifica',
      status: 'ready',
      statusLabel: 'Live preflight ready',
    });
    expect(readiness.preflightCommand).toContain('FCM_SMOKE_ROLE="PROVIDER"');
    expect(readiness.preflightCommand).toContain('FCM_SMOKE_NOTIFICATION_ID="notification-new"');
    expect(readiness.preflightCommand).toContain('npm.cmd run fcm:push-smoke -- --preflight');
  });

  it('skips deferred payment notifications when choosing an FCM preflight candidate', () => {
    const readiness = buildNotificationFcmSmokeReadiness([
      notification({
        createdAt: '2026-06-01T10:00:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-service',
            provider: 'FCM',
            pushDevice: { enabled: true, id: 'device-service', platform: 'android', role: 'CUSTOMER' },
            status: 'SENT',
          },
        ],
        id: 'notification-service',
        type: 'service.completed',
        user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
      }),
      notification({
        createdAt: '2026-06-01T10:04:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:05:00.000Z',
            id: 'delivery-payment',
            provider: 'FCM',
            pushDevice: { enabled: true, id: 'device-payment', platform: 'android', role: 'CUSTOMER' },
            status: 'SENT',
          },
        ],
        id: 'notification-payment',
        type: 'payment.updated',
        user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
      }),
    ]);

    expect(readiness).toMatchObject({
      selectedNotificationId: 'notification-service',
      selectedNotificationLabel: 'Service Completed notifica',
      status: 'ready',
    });
    expect(readiness.preflightCommand).toContain('FCM_SMOKE_NOTIFICATION_ID="notification-service"');
    expect(readiness.preflightCommand).not.toContain('notification-payment');
  });

  it('asks for a non-payment FCM notification when only deferred payment candidates are reusable', () => {
    const readiness = buildNotificationFcmSmokeReadiness([
      notification({
        createdAt: '2026-06-01T10:04:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:05:00.000Z',
            id: 'delivery-payment',
            provider: 'FCM',
            pushDevice: { enabled: true, id: 'device-payment', platform: 'android', role: 'CUSTOMER' },
            status: 'SENT',
          },
        ],
        id: 'notification-payment',
        type: 'payment.updated',
        user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
      }),
    ]);

    expect(readiness).toMatchObject({
      detail:
        'Reusable FCM delivery exists only on deferred payment notifications. Select or create a non-payment FCM notification before running registered-device preflight.',
      preflightCommand: null,
      selectedNotificationId: null,
      status: 'needs-notification',
      statusLabel: 'Needs non-payment FCM delivery',
    });
  });

  it('summarizes the latest FCM SENT delivery for the channel card', () => {
    const summary = buildNotificationChannelSummary(
      [
        notification({
          createdAt: '2026-06-01T10:00:00.000Z',
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:01:00.000Z',
              id: 'delivery-customer',
              provider: 'FCM',
              pushDevice: { enabled: true, id: 'device-customer', platform: 'android', role: 'CUSTOMER' },
              status: 'SENT',
            },
          ],
          id: 'notification-customer',
          type: 'payment.updated',
          user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
        }),
        notification({
          createdAt: '2026-06-01T10:04:00.000Z',
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:05:00.000Z',
              id: 'delivery-partner',
              provider: 'FCM',
              pushDevice: { enabled: true, id: 'device-partner', platform: 'android', role: 'PROVIDER' },
              status: 'SENT',
            },
          ],
          id: 'notification-partner',
          type: 'earning.created',
          user: providerUser('provider-user-1'),
        }),
      ],
      [],
    );

    expect(summary.latestFcmSentAttemptLabel).toBe('1 Jun 2026, 17:05');
    expect(summary.latestFcmSentDetail).toBe(
      'Partner +84900000002 / android / Earning Created notifica / device device-p',
    );
  });

  it('warns when registered-device preflight would reuse an older enabled device', () => {
    const readiness = buildNotificationFcmSmokeReadiness([
      notification({
        createdAt: '2026-06-13T18:45:00.000Z',
        deliveries: [
          {
            attemptedAt: '2026-06-13T18:45:24.000Z',
            id: 'delivery-enabled-old',
            provider: 'FCM',
            pushDevice: {
              enabled: true,
              id: 'device-enabled-old',
              platform: 'android',
              role: 'CUSTOMER',
              updatedAt: '2026-05-21T11:11:22.000Z',
            },
            status: 'SENT',
          },
        ],
        id: 'notification-live-smoke',
        type: 'service.completed',
        user: {
          id: 'customer-user-1',
          phone: '+84900000001',
          pushDevices: [
            {
              enabled: false,
              id: 'device-disabled-new',
              platform: 'android',
              role: 'CUSTOMER',
              updatedAt: '2026-06-13T13:29:19.000Z',
            },
            {
              enabled: true,
              id: 'device-enabled-old',
              platform: 'android',
              role: 'CUSTOMER',
              updatedAt: '2026-05-21T11:11:22.000Z',
            },
          ],
          roles: ['CUSTOMER'],
        },
      }),
    ]);

    expect(readiness).toMatchObject({
      selectedNotificationId: 'notification-live-smoke',
      status: 'ready',
      statusLabel: 'Live preflight ready',
    });
    expect(readiness.deviceWarningLabel).toContain('Newer Customer android device');
    expect(readiness.deviceWarningLabel).toContain('is disabled; preflight reuses older enabled device');
    expect(readiness.deviceWarningLabel).toContain('Refresh the app FCM token before broad push.');
  });

  it('marks FCM preflight as blocked when no enabled device can be reused', () => {
    const readiness = buildNotificationFcmSmokeReadiness([
      notification({
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-disabled',
            provider: 'FCM',
            pushDevice: { enabled: false, id: 'device-disabled', platform: 'android' },
            status: 'FAILED',
          },
        ],
        id: 'notification-disabled',
        type: 'payment.updated',
        user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
      }),
    ]);

    expect(readiness).toMatchObject({
      preflightCommand: null,
      selectedNotificationId: null,
      status: 'needs-device',
      statusLabel: 'Needs enabled device',
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

  it('uses the latest delivery status for failed and sent review queues', () => {
    const notifications = [
      notification({
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:00:00.000Z',
            id: 'delivery-old-failed',
            provider: 'FCM',
            status: 'FAILED',
          },
          {
            attemptedAt: '2026-06-01T10:05:00.000Z',
            id: 'delivery-new-sent',
            provider: 'FCM',
            pushDevice: { enabled: true, id: 'device-recovered', platform: 'android' },
            status: 'SENT',
          },
        ],
        id: 'notification-recovered',
        type: 'booking.requested',
      }),
      notification({
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:06:00.000Z',
            id: 'delivery-current-failed',
            provider: 'FCM',
            status: 'FAILED',
          },
        ],
        id: 'notification-current-failed',
        type: 'booking.requested',
      }),
    ];

    expect(
      filterNotifications(notifications, { booking: '', review: 'failed' }).map((item) => item.id),
    ).toEqual(['notification-current-failed']);
    expect(
      filterNotifications(notifications, { booking: '', review: 'sent' }).map((item) => item.id),
    ).toEqual(['notification-recovered']);
    expect(buildNotificationDeliveryStats(notifications)).toMatchObject({
      failedDeliveries: 2,
      failedNotifications: 1,
      sentDeliveries: 1,
    });
    expect(buildNotificationSummary(notifications).failed).toBe(1);
    expect(buildNotificationTableRows(notifications.slice(0, 1))[0]).toMatchObject({
      opsHint: expect.stringContaining('Latest attempt 1 Jun 2026, 17:05'),
      opsSignal: 'Delivered',
      signalClassName: 'signal signal-ok',
    });
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
        createdAt: '2026-06-01T10:00:00.000Z',
        deliveries: [
          {
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
          },
        ],
        id: 'stale-device',
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

    expect(sorted.map((item) => item.id)).toEqual(['failed', 'stale-device', 'sent', 'pending-newest']);
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
    expect(model.metrics.find((metric) => metric.label === 'Needs retry')?.helper).toBe(
      'Failed, disabled, or stale token delivery paths.',
    );
    expect(model.notifications.map((item) => item.id)).toEqual(['notification-failed']);
    expect(model.notificationRows.map((row) => row.id)).toEqual(['notification-failed']);
    expect(model.reviewRunbook).toMatchObject({ title: 'Retry gate' });
    expect(model.summary).toMatchObject({ failed: 1, sent: 1 });
  });

  it('paginates notification table rows without changing metrics or filtered totals', () => {
    const notifications = Array.from({ length: 25 }, (_, index) =>
      notification({
        createdAt: `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
        deliveries: [],
        id: `notification-${index + 1}`,
        type: 'booking.requested',
      }),
    );

    const model = buildNotificationPageModel({
      notifications,
      operationalPolicies: [],
      params: { page: '2', review: 'all' },
    });

    expect(model.metrics.find((metric) => metric.label === 'Total')?.value).toBe(25);
    expect(model.notifications).toHaveLength(25);
    expect(model.notificationRows).toHaveLength(5);
    expect(model.notificationPagination).toMatchObject({
      from: 21,
      page: 2,
      to: 25,
      totalPages: 2,
      totalRows: 25,
    });
  });

  it('uses server notification summary for range totals without loading every row', () => {
    const notifications = Array.from({ length: 20 }, (_, index) =>
      notification({
        createdAt: `2026-06-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`,
        deliveries: [],
        id: `notification-${index + 1}`,
        type: 'booking.requested',
      }),
    );

    const model = buildNotificationPageModel({
      notifications,
      notificationSummary: {
        generatedAt: '2026-06-27T00:00:00.000Z',
        totalCount: 2400,
      },
      operationalPolicies: [],
      params: { page: '2', review: 'all' },
    });

    expect(model.metrics.find((metric) => metric.label === 'Total')?.value).toBe(2400);
    expect(model.totalCount).toBe(2400);
    expect(model.loadedCount).toBe(20);
    expect(model.notificationRows).toHaveLength(20);
    expect(model.notificationPagination).toMatchObject({
      from: 21,
      page: 2,
      to: 40,
      totalPages: 120,
      totalRows: 2400,
    });
  });

  it('uses server notification summary metrics instead of the currently loaded page rows', () => {
    const model = buildNotificationPageModel({
      notifications: [],
      notificationSummary: {
        generatedAt: '2026-06-27T00:00:00.000Z',
        totalCount: 2400,
        disabledDevices: 17,
        failed: 13,
        fcmDeliveries: 172,
        inAppDeliveries: 64,
        needsRetry: 19,
        noShow: 4,
        partnerAlertCount: 33,
        payoutSetup: 5,
        pending: 8,
        sent: 121,
        skipped: 7,
        staleDevices: 6,
      },
      operationalPolicies: [],
      params: {},
    });

    expect(Object.fromEntries(model.metrics.map((metric) => [metric.label, metric.value]))).toMatchObject({
      'Disabled devices': 17,
      Failed: 13,
      'FCM route': 172,
      'Needs retry': 19,
      'No-show alerts': 4,
      'Partner alerts': 33,
      'Payout setup': 5,
      Pending: 8,
      Sent: 121,
      Skipped: 7,
      'Stale devices': 6,
      Total: 2400,
    });
    expect(model.opsQueue.map((item) => [item.key, item.count])).toEqual([
      ['failed', 13],
      ['disabled-devices', 17],
      ['stale-devices', 6],
      ['skipped', 7],
      ['pending', 8],
    ]);
    expect(model.channelSummary).toMatchObject({
      fcmDeliveries: 172,
      inAppDeliveries: 64,
      partnerAlertCount: 33,
    });
  });

  it('builds the FCM route model with retry confirmation guidance', () => {
    const model = buildNotificationPageModel({
      notifications: [
        notification({
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:01:00.000Z',
              id: 'delivery-fcm-failed',
              provider: 'FCM',
              status: 'FAILED',
            },
          ],
          id: 'notification-fcm-failed',
          type: 'payment.updated',
          user: { id: 'customer-user-1', phone: '+84900000001', roles: ['CUSTOMER'] },
        }),
      ],
      operationalPolicies: [],
      params: {
        confirm: 'retry',
        notificationId: 'notification-fcm-failed',
        review: 'fcm',
      },
    });

    expect(model.activeFilter?.label).toBe('FCM');
    expect(model.notifications.map((item) => item.id)).toEqual(['notification-fcm-failed']);
    expect(model.reviewRunbook).toMatchObject({ title: 'FCM route gate' });
    expect(model.confirmation?.cancelHref).toBe('/notifications?review=fcm');
    expect(model.confirmation?.description).toContain('Runbook: FCM route gate.');
    expect(model.confirmation?.supportingLinks).toEqual(
      expect.arrayContaining([
        {
          description: 'Open FCM setup checks, token smoke, and recovery smoke commands.',
          href: '/setup#notifications',
          label: 'FCM setup',
        },
      ]),
    );
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
    expect(rows[0]?.actions.map((action) => action.label)).toEqual(['Open booking', 'Audit trail', 'Retry']);
    expect(rows[0]?.actions.find((action) => action.label === 'Audit trail')).toMatchObject({
      href: '/audit-log?bucket=Notification&q=notification-row&range=all',
    });
    expect(rows[0]?.actions.find((action) => action.label === 'Retry')).toMatchObject({
      description: 'Review the delivery issue before retrying this notification.',
      tone: 'warning',
    });
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      attemptedAt: '2026-06-01T10:01:00.000Z',
      deviceFreshnessLabel: 'Token timestamp current',
      deviceLastSeenAt: '2026-06-01T10:02:00.000Z',
      deviceStateLabel: 'Device disabled',
      enableDeviceHref: '/notifications?confirm=enable-device&pushDeviceId=device-disabled',
      failureCodeLabel: 'BAD_TOKEN',
      httpStatusLabel: '400',
      recoveryHintLabel:
        'Ask the customer or Partner to reopen the app, then re-enable only after the token path is current.',
      statusClassName: 'pill pill-warn',
    });
  });

  it('does not duplicate Partner prefixes in notification table labels', () => {
    const rows = buildNotificationTableRows([
      notification({
        deliveries: [],
        id: 'notification-provider-name',
        type: 'provider.payout_setup_required',
        user: {
          phone: '+8491',
          providerProfile: {
            displayName: 'Provider Linh',
            id: 'partner-provider-name',
            status: 'APPROVED',
          },
        },
      }),
      notification({
        deliveries: [],
        id: 'notification-partner-name',
        type: 'provider.payout_setup_required',
        user: {
          phone: '+8492',
          providerProfile: {
            displayName: 'Partner Mai',
            id: 'partner-partner-name',
            status: 'APPROVED',
          },
        },
      }),
    ]);

    expect(rows.map((row) => row.partnerLabel)).toEqual(['Partner Linh', 'Partner Mai']);
  });

  it('keeps active queue context on row confirmation links', () => {
    const rows = buildNotificationTableRows(
      [
        notification({
          data: { bookingId: 'booking-123456' },
          deliveries: [
            {
              attemptedAt: '2026-06-01T10:01:00.000Z',
              id: 'delivery-disabled',
              provider: 'FCM',
              pushDevice: {
                enabled: false,
                id: 'device-disabled',
                platform: 'ios',
              },
              status: 'FAILED',
            },
          ],
          id: 'notification-row',
          type: 'booking.requested',
        }),
      ],
      { booking: 'booking-123456', review: 'failed' },
    );

    expect(rows[0]?.actions.find((action) => action.label === 'Retry')).toMatchObject({
      href: '/notifications?review=failed&booking=booking-123456&confirm=retry&notificationId=notification-row',
    });
    expect(rows[0]?.deliveryRows[0]?.enableDeviceHref).toBe(
      '/notifications?review=failed&booking=booking-123456&confirm=enable-device&pushDeviceId=device-disabled',
    );
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
              failureCode: 'messaging/mismatched-credential',
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
      failureCodeLabel: 'Firebase project mismatch',
      failureReasonLabel: 'registration token [masked]',
      provider: 'FCM',
      recoveryHintLabel:
        'Install Firebase Admin SDK JSON from the same Firebase project as the mobile app configs before retrying.',
      status: 'FAILED',
      statusClassName: 'pill pill-warn',
    });
  });

  it('labels API-stored FCM token failure metadata for failed queue review', () => {
    const rows = buildNotificationTableRows([
      notification({
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-token-failed',
            provider: 'FCM',
            pushDevice: {
              enabled: true,
              id: 'device-token',
              lastSeenAt: '2026-06-01T10:02:00.000Z',
              platform: 'android',
            },
            response: {
              failureCode: 'messaging/registration-token-not-registered',
              reason: 'registration token [masked] is not registered',
              statusCode: 404,
            },
            status: 'FAILED',
          },
        ],
        id: 'notification-token-failed',
        type: 'payment.updated',
      }),
    ]);

    expect(rows[0]).toMatchObject({
      opsSignal: 'Retry needed',
      signalClassName: 'signal signal-warn',
    });
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      failureCodeLabel: 'FCM token needs refresh',
      failureReasonLabel: 'registration token [masked] is not registered',
      httpStatusLabel: '404',
      recoveryHintLabel:
        'Ask the user to reopen the app so it can register a fresh FCM token before retrying.',
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
    const notifications = [
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
    ];
    const rows = buildNotificationTableRows(notifications);

    expect(rows[0]).toMatchObject({
      opsSignal: 'Stale device',
      signalClassName: 'signal signal-warn',
    });
    expect(filterNotifications(notifications, { booking: '', review: 'needs-retry' })).toHaveLength(1);
    expect(buildNotificationSummary(notifications).needsRetry).toBe(1);
    expect(rows[0]?.opsHint).toContain('Push token timestamp is old');
    expect(rows[0]?.actions.find((action) => action.label === 'Retry')).toMatchObject({
      description: 'Refresh the app FCM token before retrying this notification.',
      tone: 'warning',
    });
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      deviceFreshnessLabel: '30+ day token timestamp',
      deviceStateLabel: 'Device enabled',
      recoveryHintLabel:
        'Ask the user to reopen the app so the token refreshes, then prefer token recovery smoke before retrying.',
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
      range: 'today',
      review: 'failed',
      user: '',
    });
    expect(buildNotificationFilters({})).toEqual({
      booking: '',
      range: 'today',
      review: 'needs-retry',
      user: '',
    });
    expect(
      buildNotificationListHref({ booking: 'booking-1', range: 'today', review: 'failed' }, { page: 2 }),
    ).toBe('/notifications?review=failed&booking=booking-1&page=2');
    expect(
      buildNotificationListHref({ booking: 'booking-1', range: 'today', review: 'failed' }, { page: 1 }),
    ).toBe('/notifications?review=failed&booking=booking-1');
    expect(buildNotificationListHref({ booking: '', range: '7d', review: 'failed' })).toBe(
      '/notifications?range=7d&review=failed',
    );
    expect(buildNotificationListHref({ booking: '', review: 'all' })).toBe('/notifications?review=all');
    expect(notificationDateRangeLinks.map((item) => item.range)).toEqual([
      'today',
      'yesterday',
      '7d',
      '30d',
      'all',
    ]);
    expect(notificationDateRangeLabel('30d')).toBe('Last 30 days');
    expect(buildNotificationApiHref({ range: 'all', review: 'all' })).toBe('/admin/notifications?take=20');
    expect(buildNotificationApiHref({ page: '3', range: 'all', review: 'all' })).toBe(
      '/admin/notifications?take=20&skip=40',
    );
    expect(buildNotificationSummaryApiHref({ range: 'all', review: 'all' })).toBe(
      '/admin/notifications/summary',
    );
    const defaultApiHref = buildNotificationApiHref({});
    const defaultApiUrl = new URL(defaultApiHref, 'http://admin.local');
    expect(defaultApiUrl.pathname).toBe('/admin/notifications');
    expect(defaultApiUrl.searchParams.get('take')).toBe('20');
    expect(defaultApiUrl.searchParams.get('review')).toBe('needs-retry');
    expect(Number.isFinite(Date.parse(defaultApiUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(defaultApiUrl.searchParams.get('to') ?? ''))).toBe(true);
    const defaultSummaryHref = buildNotificationSummaryApiHref({});
    const defaultSummaryUrl = new URL(defaultSummaryHref, 'http://admin.local');
    expect(defaultSummaryUrl.pathname).toBe('/admin/notifications/summary');
    expect(defaultSummaryUrl.searchParams.get('review')).toBe('needs-retry');
    expect(Number.isFinite(Date.parse(defaultSummaryUrl.searchParams.get('from') ?? ''))).toBe(true);
    expect(Number.isFinite(Date.parse(defaultSummaryUrl.searchParams.get('to') ?? ''))).toBe(true);
    expect(buildNotificationPolicyApiHref()).toBe(
      '/admin/operational-policy?keys=notification.partner_alert_channel',
    );
    const filteredApiHref = buildNotificationApiHref({
      booking: 'booking-1',
      page: '2',
      range: 'all',
      review: 'failed',
    });
    const filteredApiUrl = new URL(filteredApiHref, 'http://admin.local');
    expect(filteredApiUrl.pathname).toBe('/admin/notifications');
    expect(filteredApiUrl.searchParams.get('take')).toBe('20');
    expect(filteredApiUrl.searchParams.get('skip')).toBe('20');
    expect(filteredApiUrl.searchParams.get('review')).toBe('failed');
    expect(filteredApiUrl.searchParams.get('booking')).toBe('booking-1');
    const filteredSummaryHref = buildNotificationSummaryApiHref({
      booking: 'booking-1',
      range: 'all',
      review: 'failed',
    });
    const filteredSummaryUrl = new URL(filteredSummaryHref, 'http://admin.local');
    expect(filteredSummaryUrl.pathname).toBe('/admin/notifications/summary');
    expect(filteredSummaryUrl.searchParams.get('review')).toBe('failed');
    expect(filteredSummaryUrl.searchParams.get('booking')).toBe('booking-1');
    expect(notificationFilterLinks.find((item) => item.review === 'all')).toEqual({
      href: '/notifications?review=all',
      label: 'All notifications',
      review: 'all',
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
      'latest delivery attempts that returned an FCM push failure.',
    );
    expect(notificationFilterDescription('partner-alerts')).toBe(
      'booking and payout alerts sent to Partners.',
    );
    expect(notificationFilterDescription('stale-device')).toBe(
      'delivery attempts made with old push token timestamps.',
    );
    expect(notificationFilterDescription('unknown')).toBe('all notification records.');
    expect(emptyNotificationMessage('', undefined, (value) => `short-${value}`)).toBe(
      'No notifications loaded.',
    );
    expect(emptyNotificationMessage('failed', undefined, (value) => `short-${value}`)).toBe(
      'No notifications currently match this queue. latest delivery attempts that returned an FCM push failure.',
    );
    expect(emptyNotificationMessage('failed', 'booking-1', (value) => `short-${value}`)).toBe(
      'No notifications currently match booking short-booking-1. Confirm the booking created an alert row before retrying delivery.',
    );
    expect(notificationReviewRunbook('failed')).toMatchObject({
      primaryAction:
        'Open the row delivery evidence and audit trail, fix the blocker, then use Retry only after the delivery path is valid.',
      title: 'Retry gate',
    });
    expect(notificationReviewRunbook('fcm')).toMatchObject({
      title: 'FCM route gate',
    });
    expect(notificationReviewRunbook('disabled-device')).toMatchObject({
      title: 'Device recovery gate',
    });
    expect(notificationReviewRunbook('stale-device')).toMatchObject({
      title: 'Token freshness gate',
    });
    expect(notificationReviewRunbook('pending')).toMatchObject({
      title: 'Worker path gate',
    });
    expect(notificationReviewRunbook('unknown')).toBeNull();
  });

  it('keeps direct user notification links bounded by user id on list and summary APIs', () => {
    expect(buildNotificationFilters({ range: 'all', review: 'all', user: 'user-1' })).toEqual({
      booking: '',
      range: 'all',
      review: 'all',
      user: 'user-1',
    });
    expect(buildNotificationListHref({ booking: '', range: 'all', review: 'all', user: 'user-1' })).toBe(
      '/notifications?range=all&review=all&user=user-1',
    );

    const apiHref = buildNotificationApiHref({ range: 'all', review: 'all', user: 'user-1' });
    const apiUrl = new URL(apiHref, 'http://admin.local');
    expect(apiUrl.pathname).toBe('/admin/notifications');
    expect(apiUrl.searchParams.get('take')).toBe('20');
    expect(apiUrl.searchParams.get('user')).toBe('user-1');

    const summaryHref = buildNotificationSummaryApiHref({ range: 'all', review: 'all', user: 'user-1' });
    const summaryUrl = new URL(summaryHref, 'http://admin.local');
    expect(summaryUrl.pathname).toBe('/admin/notifications/summary');
    expect(summaryUrl.searchParams.get('user')).toBe('user-1');
  });

  it('builds shared review state from the active notification queue', () => {
    expect(buildNotificationReviewState('failed')).toEqual({
      activeFilter: {
        href: '/notifications?review=failed',
        label: 'Failed sends',
        review: 'failed',
      },
      runbook: expect.objectContaining({
        title: 'Retry gate',
      }),
    });
    expect(buildNotificationReviewState('unknown')).toEqual({
      activeFilter: undefined,
      runbook: null,
    });
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

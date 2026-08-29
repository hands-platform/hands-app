import type { AdminNotification } from '../../lib/admin-api';
import {
  buildNotificationApiHref,
  buildNotificationChannelMetrics,
  buildNotificationSummaryApiHref,
  buildNotificationChannelSummary,
  buildNotificationDeliveryStats,
  buildNotificationDeliveryOpsQueue,
  buildNotificationDeliveryHref,
  buildNotificationDeliveryView,
  buildNotificationFilters,
  buildNotificationFcmSmokeReadiness,
  buildNotificationListHref,
  buildNotificationPageModel,
  buildNotificationPartnerAlertSmokeFallback,
  buildNotificationPolicyApiHref,
  buildNotificationRecordMetrics,
  buildNotificationReviewState,
  buildNotificationSummary,
  buildNotificationTableRows,
  emptyNotificationMessage,
  filterNotifications,
  groupSystemIncidentNotifications,
  isStalePushDeviceDelivery,
  notificationFilterDescription,
  notificationFilterLinks,
  notificationFinanceAgeLinks,
  notificationDeliveryHealthState,
  notificationDateRangeLabel,
  notificationDateRangeLinks,
  notificationReviewRunbook,
  sortFinanceReviewNotifications,
  sortNotifications,
} from './notification-page-model';
import { buildFcmPushSmokeCommand } from './fcm-smoke-commands';

describe('notification page model', () => {
  it('keeps current clear and historical debt independent', () => {
    expect(notificationDeliveryHealthState({
      currentDeliveryGaps: 0,
      currentFailed: 0,
      currentNoPushPathRecipientCount: 0,
      currentStaleRouteNotifications: 0,
      historicalDeliveryGaps: 2,
      historicalDeliveryIncidentCount: 1,
      historicalFailed: 3,
      historicalNoPushPathRecipientCount: 4,
      historicalStaleRouteNotifications: 5,
      generatedAt: '2026-08-10T00:00:00.000Z',
      openDeliveryIncidentCount: 0,
      totalCount: 0,
    })).toEqual({ current: 'clear', history: 'attention' });
  });

  it('does not turn a partial health summary into zero debt', () => {
    expect(notificationDeliveryHealthState({
      currentDeliveryGaps: 0,
      currentFailed: 0,
      currentNoPushPathRecipientCount: 0,
      currentStaleRouteNotifications: 0,
      generatedAt: '2026-08-10T00:00:00.000Z',
      openDeliveryIncidentCount: 0,
      totalCount: 0,
    })).toEqual({ current: 'clear', history: 'unavailable' });
    expect(notificationDeliveryHealthState(null)).toEqual({
      current: 'unavailable',
      history: 'unavailable',
    });
  });

  it('preserves one exact failure group through scope and pagination URLs', () => {
    const view = buildNotificationDeliveryView({
      failureCode: 'messaging/mismatched-credential',
      failureProvider: 'fcm',
      issue: 'failed',
      page: '2',
      scope: 'history',
    });

    expect(buildNotificationDeliveryHref(view)).toBe(
      '/notifications?issue=failed&scope=history&failureProvider=FCM&failureCode=messaging%2Fmismatched-credential&page=2',
    );
    expect(buildNotificationApiHref({
      failureCode: view.failureCode,
      failureProvider: view.failureProvider,
      range: 'all',
      review: 'failed',
      scope: view.scope,
    })).toContain('failureProvider=FCM&failureCode=messaging%2Fmismatched-credential');
  });

  it('uses safe recipient labels for unnamed Customer, Partner, and Admin rows', () => {
    const rows = buildNotificationTableRows([
      notification({ deliveries: [], id: 'customer-notification', type: 'customer.booking_created', user: { id: 'customer-123456', phone: '+849011112222' } }),
      notification({
        deliveries: [],
        id: 'partner-notification',
        type: 'provider.booking_requested',
        user: {
          id: 'partner-user-123456',
          phone: '+849033334444',
          providerProfile: { displayName: 'Lan', id: 'partner-profile-1' },
        },
      }),
      notification({ deliveries: [], id: 'admin-notification', type: 'admin.system.notice', user: { id: 'admin-123456', phone: '+849055556666' } }),
    ]);
    const renderedModel = JSON.stringify(rows);

    expect(rows[0]?.userLabel).toBe('••• ••• 2222');
    expect(rows[1]?.userLabel).toBe('Lan');
    expect(rows[2]?.userLabel).toBe('••• ••• 6666');
    expect(renderedModel).not.toContain('+849011112222');
    expect(renderedModel).not.toContain('+849033334444');
    expect(renderedModel).not.toContain('+849055556666');
  });

  it('uses enabled push routes, not app presence, for notification recipient status', () => {
    const [activeRoute, inactiveRoute] = buildNotificationTableRows([
      notification({
        deliveries: [],
        id: 'active-route',
        type: 'customer.booking_created',
        user: { id: 'customer-active', pushDevices: [{ enabled: true, id: 'device-active' }] },
      }),
      notification({
        deliveries: [],
        id: 'inactive-route',
        type: 'customer.booking_created',
        user: { id: 'customer-inactive', pushDevices: [{ enabled: false, id: 'device-inactive' }] },
      }),
    ]);

    expect(activeRoute?.userAvatarStatus).toBe('online');
    expect(inactiveRoute?.userAvatarStatus).toBe('offline');
  });

  it('opens a failure group with the exact provider and code predicate', () => {
    const row = buildNotificationTableRows([notification({
      data: {
        deliveryIncidentAffectedUserCount: 2,
        deliveryIncidentFailureCode: 'messaging/mismatched-credential',
        deliveryIncidentFirstOccurredAt: '2026-08-05T06:00:00.000Z',
        deliveryIncidentKey: 'FCM:messaging/mismatched-credential',
        deliveryIncidentLastOccurredAt: '2026-08-05T07:00:00.000Z',
        deliveryIncidentNotificationCount: 4,
        deliveryIncidentProvider: 'FCM',
      },
      deliveries: [],
      id: 'incident-representative',
      type: 'customer.booking_created',
    })])[0];

    expect(row?.incident).toMatchObject({
      href: '/notifications?issue=failed&failureProvider=FCM&failureCode=messaging%2Fmismatched-credential',
      manageHref: '/notifications?incidentProvider=FCM&incidentFailureCode=messaging%2Fmismatched-credential',
      ownerLabel: 'Developer / System',
      provider: 'FCM',
      sourceKey: 'delivery-failure:v1:production:FCM:messaging%2Fmismatched-credential',
    });
  });
  it('builds notification summary counts from delivery and alert records', () => {
    const summary = buildNotificationSummary(buildNotifications());

    expect(summary).toEqual({
      awaitingWorker: 0,
      deliveryGaps: 0,
      deliveryIncidentNotifications: 0,
      deliveryIncidents: 0,
      disabledDevices: 1,
      disabledDeviceUsers: 1,
      failed: 1,
      failedAttempts: 1,
      historicalDeliveryIncidents: 1,
      needsRetry: 1,
      noShow: 1,
      noPushPath: 1,
      payoutSetup: 1,
      pending: 1,
      sent: 2,
      skipped: 1,
      staleDevices: 1,
      staleDeviceUsers: 1,
      unattempted: 1,
    });
  });

  it('builds reusable delivery stats for summary and operations queue models', () => {
    expect(buildNotificationDeliveryStats(buildNotifications())).toEqual({
      disabledDevices: 1,
      disabledDeviceUsers: 1,
      failedDeliveries: 1,
      failedNotifications: 1,
      pendingNotifications: 1,
      retrySignalNotifications: 1,
      sentDeliveries: 2,
      skippedDeliveries: 1,
      skippedNotifications: 1,
      staleDevices: 1,
      staleDeviceUsers: 1,
      stalePushDeviceDeliveries: 1,
    });
  });

  it('builds delivery operations queue cards from actionable delivery states', () => {
    const notifications = buildNotifications();
    const queue = buildNotificationDeliveryOpsQueue(
      notifications,
      buildNotificationDeliveryStats(notifications),
      1,
    );

    expect(queue).toEqual([
      {
        actionLabel: 'Review unconfirmed alerts',
        count: 1,
        detail:
          'Delivery has not been confirmed after 15 minutes. Contact the user directly if the alert is urgent.',
        href: '/notifications?review=delivery-gap',
        key: 'delivery-gaps',
        label: 'Delivery not confirmed',
        tone: 'danger',
      },
      {
        actionLabel: 'Review affected users',
        count: 1,
        detail:
          '1 app route cannot receive mobile alerts. Contact the user directly if urgent and ask them to reopen the app before retrying.',
        href: '/notifications?review=disabled-device',
        key: 'disabled-devices',
        label: 'Push unavailable',
        tone: 'warning',
      },
      {
        actionLabel: 'Review inactive users',
        count: 1,
        detail:
          '1 app route has not been active for 30+ days. Ask the user to reopen the app before relying on another mobile alert.',
        href: '/notifications?review=stale-device',
        key: 'stale-devices',
        label: 'App reopen needed',
        tone: 'info',
      },
    ]);
  });

  it('keeps the delivery operations queue empty when there are no blockers', () => {
    expect(buildNotificationDeliveryOpsQueue([])).toEqual([]);
  });

  it('groups 100 current failures with the same cause into one delivery incident', () => {
    const now = new Date('2026-08-05T08:00:00.000Z');
    const notifications = Array.from({ length: 100 }, (_, index) =>
      notification({
        deliveries: [{
          attemptedAt: '2026-08-05T07:30:00.000Z',
          id: `delivery-${index}`,
          provider: 'FCM',
          response: { failureCode: 'messaging/registration-token-not-registered' },
          status: 'FAILED',
        }],
        id: `notification-${index}`,
        type: 'booking.requested',
        user: { id: `user-${index}`, phone: `+8490000${String(index).padStart(4, '0')}`, roles: ['CUSTOMER'] },
      }),
    );
    const deliveryStats = buildNotificationDeliveryStats(notifications, now);
    const summary = buildNotificationSummary(notifications, deliveryStats, now);
    const queue = buildNotificationDeliveryOpsQueue(notifications, deliveryStats, 0, undefined, summary);

    expect(summary).toMatchObject({
      deliveryIncidentNotifications: 100,
      deliveryIncidents: 1,
      historicalDeliveryIncidents: 0,
    });
    expect(queue[0]).toMatchObject({
      count: 1,
      href: '/notifications?review=delivery-incidents',
      key: 'delivery-incidents',
      label: 'Open incidents',
    });
    expect(queue[0]?.detail).toContain('100 affected notifications');
  });

  it('moves failures older than 24 hours out of current delivery incidents', () => {
    const now = new Date('2026-08-05T08:00:00.000Z');
    const notifications = [
      notification({
        deliveries: [{
          attemptedAt: '2026-08-04T08:00:00.000Z',
          id: 'delivery-at-cutoff',
          provider: 'FCM',
          status: 'FAILED',
        }],
        id: 'notification-at-cutoff',
        type: 'booking.requested',
      }),
      notification({
        deliveries: [{
          attemptedAt: '2026-08-04T07:59:59.999Z',
          id: 'delivery-before-cutoff',
          provider: 'FCM',
          status: 'FAILED',
        }],
        id: 'notification-before-cutoff',
        type: 'booking.requested',
      }),
    ];

    expect(buildNotificationSummary(notifications, buildNotificationDeliveryStats(notifications, now), now))
      .toMatchObject({
        deliveryIncidentNotifications: 1,
        deliveryIncidents: 1,
        historicalDeliveryIncidents: 1,
      });
  });

  it('does not reopen a past failure after the latest delivery succeeds', () => {
    const now = new Date('2026-08-05T08:00:00.000Z');
    const notifications = [notification({
      deliveries: [
        {
          attemptedAt: '2026-08-05T07:00:00.000Z',
          id: 'delivery-failed-first',
          provider: 'FCM',
          status: 'FAILED',
        },
        {
          attemptedAt: '2026-08-05T07:01:00.000Z',
          id: 'delivery-sent-latest',
          provider: 'FCM',
          status: 'SENT',
        },
      ],
      id: 'notification-recovered',
      type: 'booking.requested',
    })];

    expect(buildNotificationSummary(notifications, buildNotificationDeliveryStats(notifications, now), now))
      .toMatchObject({ deliveryIncidentNotifications: 0, deliveryIncidents: 0 });
  });

  it('preserves the active list range when an operator opens a delivery queue', () => {
    const notifications = buildNotifications();
    const queue = buildNotificationDeliveryOpsQueue(
      notifications,
      buildNotificationDeliveryStats(notifications),
      1,
      {
        age: 'all',
        booking: '',
        financeAge: 'all',
        financeOwner: '',
        incidentState: 'all',
        range: '30d',
        review: 'all',
        sla: 'all',
        sort: 'newest',
        user: '',
      },
    );

    expect(queue.map((item) => item.href)).toEqual([
      '/notifications?range=30d&review=delivery-gap',
      '/notifications?range=30d&review=disabled-device',
      '/notifications?range=30d&review=stale-device',
    ]);
  });

  it('builds partner alert routing summary from policy and delivery providers', () => {
    const summary = buildNotificationChannelSummary(buildNotifications(), [
      {
        category: 'notifications',
        enforced: true,
        key: 'notification.partner_alert_channel',
        label: 'Partner alert routing',
        lifecycle: 'live',
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

  it('uses one operator-facing mobile push label for saved FCM policy copy', () => {
    expect(
      buildNotificationChannelSummary([], [
        {
          category: 'notifications',
          enforced: true,
          key: 'notification.partner_alert_channel',
          label: 'Partner alert routing',
          lifecycle: 'live',
          options: [{ label: 'In-app now, FCM push later', tradeoff: 'Mobile push is deferred.', value: 'in_app_now' }],
          value: 'in_app_now',
        },
      ]).policyLabel,
    ).toBe('In-app now, mobile push later');
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
          lifecycle: 'live',
          value: 'ONESIGNAL_FOR_ALL_BOOKINGS',
        },
      ],
    );

    expect(summary.policyLabel).toBe('Mobile push for all bookings (legacy saved value)');
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
          lifecycle: 'live',
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
            lifecycle: 'live',
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
      notification({
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:07:00.000Z',
            id: 'delivery-unresolved-failed',
            provider: 'FCM',
            status: 'FAILED',
          },
          {
            attemptedAt: '2026-06-01T10:08:00.000Z',
            id: 'delivery-unresolved-skipped',
            provider: 'FCM',
            status: 'SKIPPED',
          },
        ],
        id: 'notification-failed-then-skipped',
        type: 'booking.requested',
      }),
    ];

    expect(
      filterNotifications(notifications, { booking: '', review: 'failed' }).map((item) => item.id),
    ).toEqual(['notification-current-failed']);
    expect(
      filterNotifications(notifications, { booking: '', review: 'sent' }).map((item) => item.id),
    ).toEqual(['notification-recovered']);
    expect(
      filterNotifications(notifications, { booking: '', review: 'unresolved-failed' }).map(
        (item) => item.id,
      ),
    ).toEqual(['notification-current-failed', 'notification-failed-then-skipped']);
    expect(buildNotificationDeliveryStats(notifications)).toMatchObject({
      failedDeliveries: 3,
      failedNotifications: 1,
      sentDeliveries: 1,
    });
    expect(buildNotificationSummary(notifications).failed).toBe(1);
    const recoveredRow = buildNotificationTableRows(notifications.slice(0, 1))[0];
    expect(recoveredRow).toMatchObject({
      opsHint: expect.stringContaining('Latest attempt 1 Jun 2026, 17:05'),
      opsSignal: 'Accepted by FCM',
      signalClassName: 'signal signal-ok',
    });
    expect(recoveredRow?.actions.some((action) => action.label === 'Retry')).toBe(false);
  });

  it('keeps a failed device path actionable when another device already succeeded', () => {
    const row = buildNotificationTableRows([
      notification({
        deliveries: [
          {
            attemptedAt: '2026-06-01T10:01:00.000Z',
            id: 'delivery-device-failed',
            provider: 'FCM',
            pushDevice: {
              enabled: true,
              id: 'push-device-failed',
              lastSeenAt: '2026-06-01T10:01:00.000Z',
              platform: 'ios',
            },
            status: 'FAILED',
          },
          {
            attemptedAt: '2026-06-01T10:02:00.000Z',
            id: 'delivery-device-sent',
            provider: 'FCM',
            pushDevice: {
              enabled: true,
              id: 'push-device-sent',
              lastSeenAt: '2026-06-01T10:02:00.000Z',
              platform: 'android',
            },
            status: 'SENT',
          },
        ],
        id: 'notification-partial-delivery',
        type: 'booking.requested',
        user: {
          id: 'provider-user-partial',
          pushDevices: [
            { enabled: true, id: 'push-device-failed', platform: 'ios' },
            { enabled: true, id: 'push-device-sent', platform: 'android' },
          ],
        },
      }),
    ], { canRetry: true })[0];

    expect(row).toMatchObject({
      opsHint: expect.stringContaining('at least one delivery is still unresolved'),
      opsSignal: 'Partial delivery',
      signalClassName: 'signal signal-warn',
    });
    expect(row?.primaryAction).toMatchObject({
      label: 'Review & retry',
      description: 'The unresolved transient failure is eligible for one controlled retry.',
      tone: 'warning',
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

    expect(sorted.map((item) => item.id)).toEqual(['failed', 'sent', 'stale-device', 'pending-newest']);
  });

  it('builds the page model with filtered rows and confirmation state', () => {
    const model = buildNotificationPageModel({
      canRetry: true,
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
          user: {
            id: 'provider-user-1',
            pushDevices: [{ enabled: true, id: 'device-failed', platform: 'android', role: 'PROVIDER' }],
            roles: ['PROVIDER'],
          },
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
      ['Open delivery incidents', 0],
      ['Delivery not confirmed', 0],
      ['Push unavailable', 0],
      ['App reopen needed', 0],
    ]);
    expect(model.metrics.find((metric) => metric.label === 'Open delivery incidents')?.helper).toBe(
      '0 affected notifications, grouped by technical cause.',
    );
    expect(model.notifications.map((item) => item.id)).toEqual(['notification-failed']);
    expect(model.notificationRows.map((row) => row.id)).toEqual(['notification-failed']);
    expect(model.reviewRunbook).toMatchObject({ title: 'Failed delivery review' });
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

    expect(model.recordMetrics.find((metric) => metric.label === 'All notification records')?.value).toBe(25);
    expect(model.notifications).toHaveLength(25);
    expect(model.notificationRows).toHaveLength(10);
    expect(model.notificationPagination).toMatchObject({
      from: 11,
      page: 2,
      to: 20,
      totalPages: 3,
      totalRows: 25,
    });
  });

  it('uses server notification summary for range totals without loading every row', () => {
    const notifications = Array.from({ length: 10 }, (_, index) =>
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

    expect(model.recordMetrics.find((metric) => metric.label === 'All notification records')?.value).toBe(
      2400,
    );
    expect(model.totalCount).toBe(2400);
    expect(model.loadedCount).toBe(10);
    expect(model.notificationRows).toHaveLength(10);
    expect(model.notificationPagination).toMatchObject({
      from: 11,
      page: 2,
      to: 20,
      totalPages: 240,
      totalRows: 2400,
    });
  });

  it('keeps the final accessible notification page truthful without generating an unsupported skip', () => {
    const notifications = Array.from({ length: 10 }, (_, index) =>
      notification({
        deliveries: [],
        id: `boundary-notification-${index + 1}`,
        type: 'booking.requested',
      }),
    );
    const model = buildNotificationPageModel({
      notificationSummary: {
        generatedAt: '2026-08-27T00:00:00.000Z',
        totalCount: 84_216,
      },
      notifications,
      operationalPolicies: [],
      params: { page: '1001', range: 'all', review: 'all' },
    });

    expect(model.notificationPagination).toMatchObject({
      from: 10_001,
      page: 1001,
      to: 10_010,
      totalPages: 1001,
      totalRows: 84_216,
    });
    expect(buildNotificationApiHref({ page: '1002', range: 'all', review: 'all' })).toBe(
      '/admin/notifications?take=10&skip=10000',
    );
  });

  it('uses server notification summary metrics instead of the currently loaded page rows', () => {
    const model = buildNotificationPageModel({
      notifications: [],
      notificationSummary: {
        generatedAt: '2026-06-27T00:00:00.000Z',
        totalCount: 2400,
        disabledDevices: 17,
        disabledDeviceUsers: 9,
        failed: 13,
        failedAttempts: 851,
        deliveryIncidentNotificationCount: 851,
        historicalDeliveryIncidentCount: 4,
        fcmDeliveries: 172,
        inAppDeliveries: 64,
        needsRetry: 19,
        openDeliveryIncidentCount: 19,
        deliveryGaps: 2,
        noShow: 4,
        noPushPath: 6,
        partnerAlertCount: 33,
        payoutSetup: 5,
        pending: 8,
        sent: 121,
        skipped: 7,
        staleDevices: 6,
        staleDeviceUsers: 5,
        unattempted: 8,
      },
      operationalPolicies: [],
      params: {},
    });

    expect(Object.fromEntries(model.metrics.map((metric) => [metric.label, metric.value]))).toMatchObject({
      'Push unavailable': 9,
      'Open delivery incidents': 19,
      'Delivery not confirmed': 2,
      'App reopen needed': 5,
    });
    expect(model.opsQueue.map((item) => [item.key, item.count])).toEqual([
      ['delivery-incidents', 19],
      ['delivery-gaps', 2],
      ['disabled-devices', 9],
      ['stale-devices', 5],
    ]);
    expect(model.recordMetrics.map((metric) => [metric.label, metric.value, metric.href])).toEqual([
      ['All notification records', 2400, '/notifications?range=all&review=all'],
      ['Sent records', 121, '/notifications?range=all&review=sent'],
      ['Skipped records', 7, '/notifications?range=all&review=skipped'],
      ['Historical delivery incidents', 4, '/notifications?range=all&review=delivery-incident-history'],
      ['Push unavailable records', 6, '/notifications?range=all&review=no-push-path'],
      ['All unattempted records', 8, '/notifications?range=all&review=unattempted'],
    ]);
    expect(model.channelMetrics.map((metric) => [metric.label, metric.value, metric.href])).toEqual([
      ['Unavailable mobile routes', 17, undefined],
      ['Inactive app routes', 6, undefined],
      ['Payout setup alerts', 5, '/notifications?range=all&review=payout-setup'],
      ['Partner alert records', 33, '/notifications?range=all&review=partner-alerts'],
      ['No-show alert records', 4, '/notifications?range=all&review=no-show'],
      ['Mobile push attempts', 172, undefined],
    ]);
    expect(model.channelSummary).toMatchObject({
      fcmDeliveries: 172,
      inAppDeliveries: 64,
      partnerAlertCount: 33,
    });
  });

  it('replaces delivery KPIs with state-linked system incident KPIs', () => {
    const model = buildNotificationPageModel({
      notifications: [],
      notificationSummary: {
        generatedAt: '2026-06-27T00:00:00.000Z',
        legacySystemIncidentCount: 4,
        openSystemIncidentCount: 2,
        recoveredSystemIncidentCount: 1,
        systemIncidentCount: 7,
        totalCount: 2,
      },
      operationalPolicies: [],
      params: { incidentState: 'open', range: '7d', review: 'system-incidents' },
    });

    expect(model.metrics.map((metric) => [metric.label, metric.value, metric.scope])).toEqual([
      ['Open incidents', 2, 'Needs action'],
      ['Recovered incidents', 1, 'Last 7 days'],
      ['Legacy review', 4, 'Needs action'],
      ['Incident sources', 7, 'Last 7 days'],
    ]);
    expect(model.metrics.map((metric) => metric.href)).toEqual([
      '/notifications?range=7d&review=system-incidents&incidentState=open',
      '/notifications?range=7d&review=system-incidents&incidentState=recovered',
      '/notifications?range=7d&review=system-incidents&incidentState=legacy',
      '/notifications?range=7d&review=system-incidents',
    ]);
    expect(model.metrics.some((metric) => metric.label === 'Pending')).toBe(false);
    expect(model.metrics.some((metric) => metric.label === 'Sent')).toBe(false);
    expect(model.recordMetrics).toEqual([]);
    expect(model.channelMetrics).toEqual([]);
  });

  it('keeps historical delivery records separate from current action metrics', () => {
    const metrics = buildNotificationRecordMetrics(
      42,
      {
        awaitingWorker: 0,
        deliveryGaps: 3,
        deliveryIncidentNotifications: 0,
        deliveryIncidents: 0,
        disabledDevices: 0,
        disabledDeviceUsers: 0,
        failed: 0,
        failedAttempts: 0,
        historicalDeliveryIncidents: 0,
        needsRetry: 0,
        noShow: 0,
        noPushPath: 12,
        payoutSetup: 0,
        pending: 15,
        sent: 0,
        skipped: 0,
        staleDevices: 0,
        staleDeviceUsers: 0,
        unattempted: 15,
      },
      {
        age: 'all',
        booking: '',
        financeAge: 'all',
        financeOwner: '',
        incidentState: 'all',
        range: '7d',
        review: 'all',
        sla: 'all',
        sort: 'newest',
        user: '',
      },
    );

    expect(metrics).toEqual([
      expect.objectContaining({
        href: '/notifications?range=7d&review=all',
        kind: 'record',
        label: 'All notification records',
        scope: 'Last 7 days',
        value: 42,
      }),
      expect.objectContaining({
        href: '/notifications?range=7d&review=sent',
        label: 'Sent records',
        value: 0,
      }),
      expect.objectContaining({
        href: '/notifications?range=7d&review=skipped',
        label: 'Skipped records',
        value: 0,
      }),
      expect.objectContaining({
        href: '/notifications?range=7d&review=delivery-incident-history',
        label: 'Historical delivery incidents',
        value: 0,
      }),
      expect.objectContaining({
        href: '/notifications?range=7d&review=no-push-path',
        kind: 'record',
        label: 'Push unavailable records',
        scope: 'Last 7 days',
        value: 12,
      }),
      expect.objectContaining({
        href: '/notifications?range=7d&review=unattempted',
        kind: 'record',
        label: 'All unattempted records',
        scope: 'Last 7 days',
        value: 15,
      }),
    ]);
  });

  it('keeps channel and device context separate from current operator actions', () => {
    const metrics = buildNotificationChannelMetrics(
      {
        awaitingWorker: 0,
        deliveryGaps: 0,
        deliveryIncidentNotifications: 0,
        deliveryIncidents: 0,
        disabledDevices: 11,
        disabledDeviceUsers: 7,
        failed: 0,
        failedAttempts: 0,
        historicalDeliveryIncidents: 0,
        needsRetry: 0,
        noShow: 3,
        noPushPath: 0,
        payoutSetup: 5,
        pending: 0,
        sent: 0,
        skipped: 0,
        staleDevices: 2,
        staleDeviceUsers: 1,
        unattempted: 0,
      },
      {
        fcmDeliveries: 19,
        inAppDeliveries: 21,
        latestFcmSentAttemptLabel: null,
        latestFcmSentDetail: null,
        partnerAlertCount: 13,
        policyLabel: 'In-app now, FCM push later',
      },
      {
        age: 'all',
        booking: '',
        financeAge: 'all',
        financeOwner: '',
        incidentState: 'all',
        range: '30d',
        review: 'all',
        sla: 'all',
        sort: 'newest',
        user: '',
      },
    );

    expect(metrics.map((metric) => [metric.label, metric.value, metric.href])).toEqual([
      ['Unavailable mobile routes', 11, undefined],
      ['Inactive app routes', 2, undefined],
      ['Payout setup alerts', 5, '/notifications?range=30d&review=payout-setup'],
      ['Partner alert records', 13, '/notifications?range=30d&review=partner-alerts'],
      ['No-show alert records', 3, '/notifications?range=30d&review=no-show'],
      ['Mobile push attempts', 19, undefined],
    ]);
  });

  it('keeps FCM setup guidance out of the delivery retry confirmation', () => {
    const model = buildNotificationPageModel({
      canRetry: true,
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
          user: {
            id: 'customer-user-1',
            phone: '+84900000001',
            pushDevices: [{ enabled: true, id: 'device-customer-1', platform: 'android', role: 'CUSTOMER' }],
            roles: ['CUSTOMER'],
          },
        }),
      ],
      operationalPolicies: [],
      params: {
        confirm: 'retry',
        notificationId: 'notification-fcm-failed',
        review: 'fcm',
      },
    });

    expect(model.activeFilter?.label).toBe('Mobile push');
    expect(model.notifications.map((item) => item.id)).toEqual(['notification-fcm-failed']);
    expect(model.reviewRunbook).toMatchObject({ title: 'Mobile push records' });
    expect(model.confirmation?.cancelHref).toBe('/notifications');
    expect(model.confirmation?.description).not.toContain('Runbook: Mobile push records.');
    expect(model.confirmation?.supportingLinks).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ label: 'FCM setup' })]),
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
    ], { canRetry: true });

    expect(rows[0]).toMatchObject({
      actionLabel: 'Actions for Mai · Title · 1 Jun 2026, 16:00',
      bookingDataHint:
        'booking booking- / partner partner- / distance 400 m / marketplace radius 2.5 km / marketplace mode parallel_marketplace',
      opsSignal: 'Failed',
      partnerHref: '/partners/partner-987654',
      partnerLabel: 'Partner Mai',
      typeLabel: 'Booking Marketplace Available',
    });
    expect(rows[0]?.actions.map((action) => action.label)).toEqual(['Open booking', 'Audit trail']);
    expect(rows[0]?.actions.find((action) => action.label === 'Audit trail')).toMatchObject({
      href: '/audit-log?bucket=Notification&q=notification-row&range=all',
    });
    expect(rows[0]?.primaryAction).toMatchObject({ label: 'Open recipient' });
    expect(rows[0]?.actions.some((action) => action.label === 'Retry')).toBe(false);
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      attemptedAt: '2026-06-01T10:01:00.000Z',
      deviceFreshnessLabel: 'Token timestamp current',
      deviceLastSeenAt: '2026-06-01T10:02:00.000Z',
      deviceStateLabel: 'Device disabled',
      failureCodeLabel: 'BAD_TOKEN',
      httpStatusLabel: '400',
      recoveryHintLabel:
        'Ask the customer or Partner to reopen the app before retrying.',
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
          user: {
            id: 'provider-row',
            pushDevices: [{ enabled: true, id: 'device-enabled', platform: 'ios' }],
          },
        }),
      ],
      {
        age: 'over-24h',
        booking: 'booking-123456',
        canRetry: true,
        page: '2',
        review: 'failed',
        sort: 'oldest',
      },
    );

    expect(rows[0]?.primaryAction).toMatchObject({
      href:
        '/notifications?review=failed&age=over-24h&sort=oldest&page=2&booking=booking-123456&confirm=retry&notificationId=notification-row',
    });
    expect(JSON.stringify(rows[0]?.deliveryRows)).not.toContain('enable-device');
  });

  it('keeps the server page and queue controls on confirmation links', () => {
    const model = buildNotificationPageModel({
      canRetry: true,
      notificationSummary: {
        generatedAt: '2026-07-24T10:00:00.000Z',
        needsRetry: 20,
        totalCount: 20,
      },
      notifications: [
        notification({
          deliveries: [
            {
              attemptedAt: '2026-07-23T10:00:00.000Z',
              id: 'delivery-page-2-failed',
              provider: 'FCM',
              pushDevice: {
                enabled: true,
                id: 'device-page-2',
                platform: 'android',
              },
              status: 'FAILED',
            },
          ],
          id: 'notification-page-2',
          type: 'booking.requested',
          user: {
            id: 'provider-page-2',
            pushDevices: [{ enabled: true, id: 'device-page-2', platform: 'android' }],
          },
        }),
      ],
      operationalPolicies: [],
      params: {
        age: 'over-24h',
        page: '2',
        range: 'all',
        review: 'needs-retry',
        sort: 'oldest',
      },
    });

    expect(model.notificationRows[0]?.primaryAction).toMatchObject({
      href:
        '/notifications?range=all&age=over-24h&sort=oldest&page=2&confirm=retry&notificationId=notification-page-2',
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

  it('keeps the selected data scope in exact delivery failure group links', () => {
    const rows = buildNotificationTableRows([
      notification({
        data: {
          deliveryIncidentAffectedUserCount: 3,
          deliveryIncidentFailureCode: 'INVALID_ARGUMENT',
          deliveryIncidentFirstOccurredAt: '2026-08-01T10:00:00.000Z',
          deliveryIncidentHistory: true,
          deliveryIncidentKey: 'FCM_HTTP_V1:INVALID_ARGUMENT:2026-08-01T10:00:00.000Z',
          deliveryIncidentLastOccurredAt: '2026-08-01T10:10:00.000Z',
          deliveryIncidentNotificationCount: 96,
          deliveryIncidentProvider: 'FCM_HTTP_V1',
        },
        deliveries: [],
        id: 'notification-unknown-failure-group',
        type: 'booking.matched',
      }),
    ], { dataScope: 'unknown' });

    expect(rows[0]?.incident?.href).toBe(
      '/notifications?issue=failed&scope=history&failureProvider=FCM_HTTP_V1&failureCode=INVALID_ARGUMENT&dataScope=unknown',
    );
    expect(rows[0]?.incident?.manageHref).toBe(
      '/notifications?dataScope=unknown&incidentProvider=FCM_HTTP_V1&incidentFailureCode=INVALID_ARGUMENT',
    );
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
      opsSignal: 'Failed',
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

  it('keeps only the latest disposition for a delivery path', () => {
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

    expect(rows[0]?.deliveryRows.map((delivery) => delivery.id)).toEqual(['delivery-new']);
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      status: 'SENT',
      statusClassName: 'pill pill-success',
    });
  });

  it('keeps stale token evidence visible without reopening an already delivered notification', () => {
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
      opsSignal: 'Accepted by FCM',
      signalClassName: 'signal signal-ok',
    });
    expect(filterNotifications(notifications, { booking: '', review: 'needs-retry' })).toHaveLength(0);
    expect(buildNotificationSummary(notifications).needsRetry).toBe(0);
    expect(rows[0]?.opsHint).toContain('Device receipt or app open is not confirmed');
    expect(rows[0]?.actions.some((action) => action.label === 'Retry')).toBe(false);
    expect(rows[0]?.deliveryRows[0]).toMatchObject({
      deviceFreshnessLabel: '30+ day token timestamp',
      deviceStateLabel: 'Device enabled',
      recoveryHintLabel:
        'Ask the user to reopen the app, then review the latest delivery before retrying.',
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

  it('adds a safe internal incident action and rejects external notification destinations', () => {
    const incidentRow = buildNotificationTableRows([notification({
      data: {
        destination: '/background-jobs/incidents/incident-open-1',
        incidentId: 'incident-open-1',
      },
      deliveries: [],
      id: 'notification-incident',
      type: 'admin.system.background_job.failed',
    })])[0];
    const externalRow = buildNotificationTableRows([notification({
      data: { destination: '//evil.example/collect' },
      deliveries: [],
      id: 'notification-external',
      type: 'admin.system.background_job.failed',
    })])[0];

    expect(incidentRow?.primaryAction).toMatchObject({
      href: '/background-jobs/incidents/incident-open-1',
      kind: 'link',
      label: 'Open incident',
    });
    expect(externalRow?.actions.some((action) => (
      action.label === 'Open incident' || action.label === 'Open destination'
    ))).toBe(false);
  });

  it('keeps overdue Finance alerts in an action-only queue without delivery retry', () => {
    const notifications = [
      notification({
        data: {
          bankTransactionId: 'bank-review-1',
          destination: '/finance-tax/bank-reconciliation/bank-review-1',
          financeReviewAgeHours: 76,
          financeReviewOwner: {
            email: 'finance.owner@hands.test',
            fullName: 'Finance Owner',
            id: 'admin-finance-owner',
          },
          financeReviewSlaBand: 'OVER_72H',
          financeReviewStartedAt: '2026-07-10T02:00:00.000Z',
        },
        deliveries: [],
        id: 'notification-finance-review',
        type: 'admin.finance.bank_transaction.review_escalated',
      }),
      notification({
        data: {
          batchImportId: 'batch-1',
          destination: '/finance-tax/bank-reconciliation/import-batches/batch-1',
          financeReviewResolvedAt: '2026-07-15T05:00:00.000Z',
          financeReviewStatus: 'RESOLVED',
        },
        deliveries: [],
        id: 'notification-finance-batch',
        type: 'admin.finance.bank_statement_batch.escalated',
      }),
      notification({ deliveries: [], id: 'notification-booking', type: 'booking.matched' }),
    ];

    expect(filterNotifications(notifications, { booking: '', review: 'finance-overdue' })).toHaveLength(1);
    expect(filterNotifications(notifications, { booking: '', review: 'finance-overdue-history' })).toHaveLength(1);
    const row = buildNotificationTableRows(notifications, {
      financeAge: '72-plus',
      financeAssigneeAdminId: 'admin-current-owner',
      financeAssigneeOptions: [
        { label: 'Finance Owner', value: 'admin-finance-owner' },
        { label: 'Current Admin', value: 'admin-current-owner' },
      ],
      financeOwner: 'unassigned',
      range: 'all',
      review: 'finance-overdue',
    })[0];
    expect(row).toMatchObject({
      createdAt: '2026-07-10T02:00:00.000Z',
      opsSignal: 'Over 72h',
      relativeCreatedAtLabel: '76h open',
      typeMeaning: 'Overdue Finance reconciliation review',
      userLabel: 'Finance Owner',
      userPhone: 'finance.owner@hands.test',
    });
    expect(row?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        href: expect.stringContaining('confirm=assign-finance-review'),
        label: 'Assign to me',
        tone: 'warning',
      }),
      expect.objectContaining({
        href: expect.stringContaining('confirm=assign-finance-review'),
        label: 'Reassign owner',
        tone: 'warning',
      }),
    ]));
    expect(row?.primaryAction).toMatchObject({
      href: '/finance-tax/bank-reconciliation/bank-review-1',
      label: 'Open Finance review',
    });
    expect(row?.actions.some((action) => action.label === 'Retry')).toBe(false);
    expect(buildNotificationTableRows([notifications[1]!])[0]).toMatchObject({
      opsSignal: 'Resolved',
      typeMeaning: 'Overdue Finance reconciliation review',
    });
  });

  it('orders open Finance reviews oldest first and resolved history newest first', () => {
    const older = notification({
      createdAt: '2026-07-12T00:00:00.000Z',
      data: { financeReviewStartedAt: '2026-07-08T00:00:00.000Z' },
      deliveries: [],
      id: 'finance-older',
      type: 'admin.finance.bank_transaction.review_escalated',
    });
    const newer = notification({
      createdAt: '2026-07-11T00:00:00.000Z',
      data: { financeReviewStartedAt: '2026-07-09T00:00:00.000Z' },
      deliveries: [],
      id: 'finance-newer',
      type: 'admin.finance.bank_statement_batch.escalated',
    });
    const resolvedEarlier = notification({
      data: {
        financeReviewResolvedAt: '2026-07-13T00:00:00.000Z',
        financeReviewStatus: 'RESOLVED',
      },
      deliveries: [],
      id: 'finance-resolved-earlier',
      type: 'admin.finance.bank_transaction.review_escalated',
    });
    const resolvedLater = notification({
      data: {
        financeReviewResolvedAt: '2026-07-14T00:00:00.000Z',
        financeReviewStatus: 'RESOLVED',
      },
      deliveries: [],
      id: 'finance-resolved-later',
      type: 'admin.finance.bank_statement_batch.escalated',
    });

    expect(sortFinanceReviewNotifications([newer, older], 'open').map((item) => item.id)).toEqual([
      'finance-older',
      'finance-newer',
    ]);
    expect(
      sortFinanceReviewNotifications([resolvedEarlier, resolvedLater], 'resolved').map((item) => item.id),
    ).toEqual(['finance-resolved-later', 'finance-resolved-earlier']);
  });

  it('keeps review descriptions and empty table messages stable', () => {
    expect(buildNotificationFilters({ booking: 'booking-1', review: 'failed' })).toEqual({
      age: 'all',
      booking: 'booking-1',
      financeAge: 'all',
      financeOwner: '',
      incidentState: 'all',
      range: 'today',
      review: 'failed',
      sla: 'all',
      sort: 'newest',
      user: '',
    });
    expect(buildNotificationFilters({})).toEqual({
      age: 'all',
      booking: '',
      financeAge: 'all',
      financeOwner: '',
      incidentState: 'all',
      range: 'all',
      review: 'delivery-incidents',
      sla: 'all',
      sort: 'newest',
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
    expect(buildNotificationApiHref({ range: 'all', review: 'all' })).toBe('/admin/notifications?take=10');
    expect(buildNotificationApiHref({ page: '3', range: 'all', review: 'all' })).toBe(
      '/admin/notifications?take=10&skip=20',
    );
    expect(buildNotificationSummaryApiHref({ range: 'all', review: 'all' })).toBe(
      '/admin/notifications/summary',
    );
    const defaultApiHref = buildNotificationApiHref({});
    const defaultApiUrl = new URL(defaultApiHref, 'http://admin.local');
    expect(defaultApiUrl.pathname).toBe('/admin/notifications');
    expect(defaultApiUrl.searchParams.get('take')).toBe('10');
    expect(defaultApiUrl.searchParams.get('review')).toBe('delivery-incidents');
    expect(defaultApiUrl.searchParams.get('from')).toBeNull();
    expect(defaultApiUrl.searchParams.get('to')).toBeNull();
    const defaultSummaryHref = buildNotificationSummaryApiHref({});
    const defaultSummaryUrl = new URL(defaultSummaryHref, 'http://admin.local');
    expect(defaultSummaryUrl.pathname).toBe('/admin/notifications/summary');
    expect(defaultSummaryUrl.searchParams.get('review')).toBe('delivery-incidents');
    expect(defaultSummaryUrl.searchParams.get('from')).toBeNull();
    expect(defaultSummaryUrl.searchParams.get('to')).toBeNull();
    expect(buildNotificationSummaryApiHref({ mode: 'action', range: 'all', review: 'all' })).toBe(
      '/admin/notifications/summary?viewMode=action',
    );
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
    expect(filteredApiUrl.searchParams.get('take')).toBe('10');
    expect(filteredApiUrl.searchParams.get('skip')).toBe('10');
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
    expect(notificationFilterLinks.find((item) => item.review === 'unresolved-failed')).toEqual({
      href: '/notifications?review=unresolved-failed',
      label: 'Unresolved failures',
      review: 'unresolved-failed',
    });
    expect(notificationFilterLinks.find((item) => item.review === 'partner-alerts')).toEqual({
      href: '/notifications?review=partner-alerts',
      label: 'Partner alerts',
      review: 'partner-alerts',
    });
    expect(notificationFilterLinks.find((item) => item.review === 'stale-device')).toEqual({
      href: '/notifications?review=stale-device',
      label: 'Inactive app users',
      review: 'stale-device',
    });
    expect(notificationFilterLinks.find((item) => item.review === 'system-incidents')).toEqual({
      href: '/notifications?review=system-incidents',
      label: 'System incidents',
      review: 'system-incidents',
    });
    expect(notificationFilterLinks.find((item) => item.review === 'finance-overdue')).toEqual({
      href: '/notifications?review=finance-overdue',
      label: 'Finance overdue',
      review: 'finance-overdue',
    });
    expect(notificationFilterLinks.find((item) => item.review === 'finance-overdue-history')).toEqual({
      href: '/notifications?review=finance-overdue-history',
      label: 'Finance history',
      review: 'finance-overdue-history',
    });
    expect(notificationFilterDescription('failed')).toBe(
      'latest mobile alert attempts that were not delivered.',
    );
    expect(notificationFilterDescription('partner-alerts')).toBe(
      'booking and payout alerts sent to Partners.',
    );
    expect(notificationFilterDescription('stale-device')).toBe(
      'historical notification evidence linked to an enabled device that had not checked in for 30+ days.',
    );
    expect(notificationFilterDescription('system-incidents')).toBe(
      'Admin system and background-job alerts that require operational review.',
    );
    expect(notificationFilterDescription('finance-overdue')).toBe(
      'bank statement batches and assigned bank reviews unresolved for over 48 hours.',
    );
    expect(notificationFilterDescription('finance-overdue-history')).toBe(
      'resolved bank reconciliation SLA alerts retained for audit history.',
    );
    expect(notificationFilterDescription('unknown')).toBe('all notification records.');
    expect(emptyNotificationMessage('', undefined, (value) => `short-${value}`)).toBe(
      'No notifications loaded.',
    );
    expect(emptyNotificationMessage('failed', undefined, (value) => `short-${value}`)).toBe(
      'No notifications currently match this queue. latest mobile alert attempts that were not delivered.',
    );
    expect(emptyNotificationMessage('failed', 'booking-1', (value) => `short-${value}`)).toBe(
      'No notifications currently match booking short-booking-1. Confirm the booking created an alert row before retrying delivery.',
    );
    expect(emptyNotificationMessage('delivery-incidents', 'booking-1', (value) => `short-${value}`)).toBe(
      'No delivery incidents in the last 24 hours match booking short-booking-1.',
    );
    expect(notificationReviewRunbook('failed')).toMatchObject({
      primaryAction:
        'Contact the user directly if the alert is urgent. Review the latest attempt, then retry only when the alert is still needed.',
      title: 'Failed delivery review',
    });
    expect(notificationReviewRunbook('fcm')).toMatchObject({
      title: 'Mobile push records',
    });
    expect(notificationReviewRunbook('disabled-device')).toMatchObject({
      title: 'Push unavailable',
    });
    expect(notificationReviewRunbook('stale-device')).toMatchObject({
      title: 'App reopen needed',
    });
    expect(notificationReviewRunbook('pending')).toMatchObject({
      title: 'Unattempted history',
    });
    expect(notificationReviewRunbook('delivery-gap')).toMatchObject({
      title: 'Delivery not confirmed',
    });
    expect(notificationReviewRunbook('no-push-path')).toMatchObject({
      title: 'Push unavailable',
    });
    expect(notificationReviewRunbook('system-incidents')).toMatchObject({
      title: 'System incident gate',
    });
    expect(notificationReviewRunbook('finance-overdue')).toMatchObject({
      title: 'Finance review SLA',
    });
    expect(notificationReviewRunbook('finance-overdue-history')).toMatchObject({
      title: 'Finance SLA history',
    });
    expect(notificationReviewRunbook('unknown')).toBeNull();
  });

  it('keeps Admin system incident filtering and labels separate from customer notifications', () => {
    const notifications = [
      notification({
        data: { destination: '/background-jobs/incidents/incident-open-1' },
        deliveries: [],
        id: 'system-incident',
        type: 'admin.system.background_job.failed',
      }),
      notification({ deliveries: [], id: 'customer-booking', type: 'booking.matched' }),
    ];

    expect(
      filterNotifications(notifications, { booking: '', review: 'system-incidents' }).map(
        (item) => item.id,
      ),
    ).toEqual(['system-incident']);
    expect(buildNotificationTableRows(notifications).find((row) => row.id === 'system-incident')).toMatchObject({
      typeMeaning: 'Background job incident alert',
    });

    const apiUrl = new URL(
      buildNotificationApiHref({ range: 'all', review: 'system-incidents' }),
      'http://admin.local',
    );
    expect(apiUrl.searchParams.get('review')).toBe('system-incidents');
  });

  it('separates source incident state from notification delivery evidence', () => {
    const rows = buildNotificationTableRows([
      notification({
        data: {
          incidentId: 'incident-open',
          incidentRecoveredAt: null,
          incidentStatus: 'OPEN',
        },
        deliveries: [],
        id: 'system-open',
        type: 'admin.system.background_job.failed',
      }),
      notification({
        data: {
          incidentId: 'incident-recovered',
          incidentRecoveredAt: '2026-07-14T05:04:00.000Z',
          incidentStatus: 'RECOVERED',
        },
        deliveries: [],
        id: 'system-recovered',
        type: 'admin.system.background_job.failed',
      }),
    ]);

    expect(rows.find((row) => row.id === 'system-open')).toMatchObject({
      deliveryAttemptCount: 0,
      opsHint: 'Source incident is still open. Review the linked incident before retrying this alert.',
      opsSignal: 'Incident open',
      signalClassName: 'signal signal-warn',
    });
    expect(rows.find((row) => row.id === 'system-recovered')).toMatchObject({
      deliveryAttemptCount: 0,
      opsHint: expect.stringContaining('Source incident recovered'),
      opsSignal: 'Recovered',
      signalClassName: 'signal signal-ok',
    });
  });

  it('does not present legacy unlinked system alerts as pending delivery work', () => {
    const row = buildNotificationTableRows([
      notification({
        data: {
          destination: '/background-jobs',
          jobId: 'repeat:background-job-failure-monitor:1783980324023',
          queueName: 'bank-statement-escalation',
        },
        deliveries: [],
        id: 'legacy-system-alert',
        type: 'admin.system.background_job.failed',
      }),
    ])[0];

    expect(row).toMatchObject({
      deliveryAttemptCount: 0,
      bookingDataHint: 'queue bank-statement-escalation / job ...re-monitor:1783980324023',
      opsHint:
        'This legacy system alert has no linked incident record. Open Background Jobs and review the source failure.',
      opsSignal: 'Review required',
      signalClassName: 'signal signal-warn',
    });
    expect(row?.actions.find((action) => action.label === 'Mark reviewed')).toMatchObject({
      href: '/notifications?confirm=review-legacy&notificationId=legacy-system-alert',
      tone: 'warning',
    });
    expect(row?.primaryAction).toMatchObject({
      href: '/background-jobs?jobId=repeat%3Abackground-job-failure-monitor%3A1783980324023&queue=bank-statement-escalation&range=ALL&review=ALL',
      label: 'Open job evidence',
    });
    expect(row?.actions.some((action) => action.label === 'Open destination')).toBe(false);
    expect(row?.actions.some((action) => action.label === 'Retry')).toBe(false);
  });

  it('groups fully loaded system alerts by source while retaining recipient evidence', () => {
    const jobOne = 'repeat:background-job-failure-monitor:1783980324023';
    const jobTwo = 'repeat:background-job-failure-monitor:1783980024023';
    const sourceNotifications = [
      notification({
        data: { jobId: jobOne, queueName: 'bank-statement-escalation' },
        deliveries: [],
        id: 'job-one-recipient-one',
        type: 'admin.system.background_job.failed',
        user: { id: 'admin-1', phone: '+84900000001', roles: ['ADMIN'] },
      }),
      notification({
        data: { jobId: jobOne, queueName: 'bank-statement-escalation' },
        deliveries: [],
        id: 'job-one-recipient-two',
        type: 'admin.system.background_job.failed',
        user: { id: 'admin-2', phone: '+84900000002', roles: ['ADMIN'] },
      }),
      notification({
        data: { jobId: jobTwo, queueName: 'bank-statement-escalation' },
        deliveries: [],
        id: 'job-two-recipient-one',
        type: 'admin.system.background_job.failed',
        user: { id: 'admin-1', phone: '+84900000001', roles: ['ADMIN'] },
      }),
      notification({
        data: { jobId: jobTwo, queueName: 'bank-statement-escalation' },
        deliveries: [],
        id: 'job-two-recipient-two',
        type: 'admin.system.background_job.failed',
        user: { id: 'admin-2', phone: '+84900000002', roles: ['ADMIN'] },
      }),
    ];

    expect(groupSystemIncidentNotifications(sourceNotifications)).toHaveLength(2);

    const model = buildNotificationPageModel({
      notificationSummary: {
        generatedAt: '2026-07-14T06:00:00.000Z',
        legacySystemIncidentCount: 2,
        openSystemIncidentCount: 0,
        recoveredSystemIncidentCount: 0,
        systemIncidentCount: 2,
        systemIncidentNotificationCount: 4,
        systemIncidentSourceSummaryComplete: true,
        systemIncidentSourceTotalCount: 2,
        totalCount: 4,
      },
      notifications: sourceNotifications,
      operationalPolicies: [],
      params: { incidentState: 'legacy', review: 'system-incidents' },
    });

    expect(model.notifications).toHaveLength(2);
    expect(model.notificationPagination).toMatchObject({ totalRows: 2, from: 1, to: 2 });
    expect(model.notificationRows).toHaveLength(2);
    expect(model.notificationRows[0]).toMatchObject({
      userLabel: '2 Admin recipients',
      userPhone: '2 retained recipient alerts',
    });
    expect(model.notificationRows[0]?.bookingDataHint).toContain('2 recipient alerts');
  });

  it('preserves server source counts and paginates beyond the loaded incident page', () => {
    const sourceNotification = notification({
      data: {
        jobId: 'repeat:background-job-failure-monitor:1783980324023',
        queueName: 'bank-statement-escalation',
        systemIncidentNotificationCount: 6,
        systemIncidentRecipientCount: 3,
        systemIncidentSourceKey: 'job:bank-statement-escalation:repeat:background-job-failure-monitor:1783980324023',
      },
      deliveries: [],
      id: 'server-representative',
      type: 'admin.system.background_job.failed',
      user: { id: 'admin-1', phone: '+84900000001', roles: ['ADMIN'] },
    });

    const model = buildNotificationPageModel({
      notificationSummary: {
        generatedAt: '2026-07-14T06:00:00.000Z',
        legacySystemIncidentCount: 45,
        openSystemIncidentCount: 0,
        recoveredSystemIncidentCount: 0,
        systemIncidentCount: 45,
        systemIncidentNotificationCount: 120,
        systemIncidentSourceSummaryComplete: true,
        systemIncidentSourceTotalCount: 45,
        totalCount: 45,
      },
      notifications: [sourceNotification],
      operationalPolicies: [],
      params: { incidentState: 'legacy', review: 'system-incidents' },
    });

    expect(model.totalCount).toBe(45);
    expect(model.notificationPagination).toMatchObject({ from: 1, to: 1, totalPages: 5, totalRows: 45 });
    expect(model.notificationRows[0]).toMatchObject({
      userLabel: '3 Admin recipients',
      userPhone: '6 retained recipient alerts',
    });
    expect(model.notificationRows[0]?.bookingDataHint).toContain('6 recipient alerts');
  });

  it('keeps reviewed legacy alerts as retained records without repeat review or retry actions', () => {
    const row = buildNotificationTableRows([notification({
      data: {
        incidentStatus: 'LEGACY_REVIEWED',
        legacyReviewedAt: '2026-07-14T06:00:00.000Z',
      },
      deliveries: [],
      id: 'reviewed-legacy-alert',
      type: 'admin.system.background_job.failed',
    })])[0];

    expect(row).toMatchObject({
      opsHint: expect.stringContaining('Legacy alert reviewed'),
      opsSignal: 'Legacy reviewed',
      signalClassName: 'signal signal-ok',
    });
    expect(row?.actions.some((action) => action.label === 'Mark reviewed')).toBe(false);
    expect(row?.actions.some((action) => action.label === 'Retry')).toBe(false);
  });

  it('keeps direct user notification links bounded by user id on list and summary APIs', () => {
    expect(buildNotificationFilters({ range: 'all', review: 'all', user: 'user-1' })).toEqual({
      age: 'all',
      booking: '',
      financeAge: 'all',
      financeOwner: '',
      incidentState: 'all',
      range: 'all',
      review: 'all',
      sla: 'all',
      sort: 'newest',
      user: 'user-1',
    });
    expect(buildNotificationListHref({ booking: '', range: 'all', review: 'all', user: 'user-1' })).toBe(
      '/notifications?range=all&review=all&user=user-1',
    );

    const apiHref = buildNotificationApiHref({ range: 'all', review: 'all', user: 'user-1' });
    const apiUrl = new URL(apiHref, 'http://admin.local');
    expect(apiUrl.pathname).toBe('/admin/notifications');
    expect(apiUrl.searchParams.get('take')).toBe('10');
    expect(apiUrl.searchParams.get('user')).toBe('user-1');

    const summaryHref = buildNotificationSummaryApiHref({ range: 'all', review: 'all', user: 'user-1' });
    const summaryUrl = new URL(summaryHref, 'http://admin.local');
    expect(summaryUrl.pathname).toBe('/admin/notifications/summary');
    expect(summaryUrl.searchParams.get('user')).toBe('user-1');
  });

  it('forwards unresolved-delivery ageing and oldest-first order to bounded APIs', () => {
    const apiUrl = new URL(
      buildNotificationApiHref({
        age: '1-4h',
        page: '2',
        range: 'all',
        review: 'unresolved-failed',
        sla: 'overdue',
        sort: 'oldest',
      }),
      'http://admin.local',
    );
    const summaryUrl = new URL(
      buildNotificationSummaryApiHref({
        age: '1-4h',
        range: 'all',
        review: 'unresolved-failed',
        sla: 'overdue',
        sort: 'oldest',
      }),
      'http://admin.local',
    );

    expect(Object.fromEntries(apiUrl.searchParams)).toMatchObject({
      age: '1-4h',
      review: 'unresolved-failed',
      skip: '10',
      sla: 'overdue',
      sort: 'oldest',
      take: '10',
    });
    expect(Object.fromEntries(summaryUrl.searchParams)).toMatchObject({
      age: '1-4h',
      review: 'unresolved-failed',
      sla: 'overdue',
      sort: 'oldest',
    });
  });

  it('keeps Finance SLA age and owner filters on list, page, and summary URLs', () => {
    expect(notificationFinanceAgeLinks.map((item) => item.value)).toEqual(['all', '48-72', '72-plus']);
    expect(buildNotificationFilters({
      financeAge: '72-plus',
      financeOwner: 'admin-owner-1',
      range: 'all',
      review: 'finance-overdue',
    })).toMatchObject({
      financeAge: '72-plus',
      financeOwner: 'admin-owner-1',
      review: 'finance-overdue',
    });
    expect(buildNotificationListHref({
      booking: '',
      financeAge: '72-plus',
      financeOwner: 'admin-owner-1',
      range: 'all',
      review: 'finance-overdue',
    })).toBe(
      '/notifications?range=all&review=finance-overdue&financeAge=72-plus&financeOwner=admin-owner-1',
    );
    expect(buildNotificationApiHref({
      financeAge: '48-72',
      financeOwner: 'unassigned',
      range: 'all',
      review: 'finance-overdue',
    })).toBe(
      '/admin/notifications?take=10&review=finance-overdue&financeAge=48-72&financeOwner=unassigned',
    );
    expect(buildNotificationSummaryApiHref({
      financeAge: '72-plus',
      financeOwner: 'admin-owner-1',
      range: 'all',
      review: 'finance-overdue-history',
    })).toBe(
      '/admin/notifications/summary?review=finance-overdue-history&financeAge=72-plus&financeOwner=admin-owner-1',
    );
    expect(buildNotificationFilters({
      financeAge: 'invalid',
      financeOwner: 'admin-owner-1',
      review: 'failed',
    })).toMatchObject({ financeAge: 'all', financeOwner: '' });
  });

  it('keeps system incident state filters on list and summary server queries', () => {
    expect(
      buildNotificationFilters({ review: 'system-incidents', incidentState: 'open' }),
    ).toMatchObject({ incidentState: 'open', review: 'system-incidents' });
    expect(
      buildNotificationFilters({ review: 'failed', incidentState: 'open' }).incidentState,
    ).toBe('all');
    expect(
      buildNotificationListHref({
        booking: '',
        incidentState: 'legacy',
        review: 'system-incidents',
      }),
    ).toBe('/notifications?review=system-incidents&incidentState=legacy');
    expect(
      buildNotificationListHref({
        booking: '',
        incidentState: 'reviewed',
        review: 'system-incidents',
      }),
    ).toBe('/notifications?review=system-incidents&incidentState=reviewed');

    const listUrl = new URL(
      buildNotificationApiHref({ review: 'system-incidents', incidentState: 'recovered' }),
      'http://admin.local',
    );
    const summaryUrl = new URL(
      buildNotificationSummaryApiHref({ review: 'system-incidents', incidentState: 'recovered' }),
      'http://admin.local',
    );
    expect(listUrl.searchParams.get('incidentState')).toBe('recovered');
    expect(summaryUrl.searchParams.get('incidentState')).toBe('recovered');
    expect(
      buildNotificationFilters({ review: 'system-incidents', incidentState: 'reviewed' }).incidentState,
    ).toBe('reviewed');
  });

  it('builds shared review state from the active notification queue', () => {
    expect(buildNotificationReviewState('failed')).toEqual({
      activeFilter: {
        href: '/notifications?review=failed',
        label: 'Failed sends',
        review: 'failed',
      },
      runbook: expect.objectContaining({
        title: 'Failed delivery review',
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

    expect(
      filterNotifications(
        [
          notification({
            deliveries: [
              {
                attemptedAt: '2026-06-02T10:00:00.000Z',
                id: 'delivery-fresh-at-send-stale-now',
                provider: 'FCM',
                pushDevice: {
                  enabled: true,
                  id: 'device-fresh-at-send-stale-now',
                  lastSeenAt: '2026-06-01T10:00:00.000Z',
                  platform: 'android',
                },
                status: 'SENT',
              },
            ],
            id: 'notification-fresh-at-send-stale-now',
            type: 'booking.matched',
          }),
        ],
        { booking: '', review: 'stale-device' },
      ).map((item) => item.id),
    ).toEqual([]);
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
  const record = data && typeof data === 'object' && !Array.isArray(data)
    ? data as Record<string, unknown>
    : {};
  const hasFailedDelivery = deliveries.some((delivery) => delivery.status === 'FAILED');
  return {
    body: 'Body',
    createdAt: createdAt ?? '2026-06-01T09:00:00.000Z',
    data: hasFailedDelivery
      ? {
          ...record,
          retryDecision: record.retryDecision ?? {
            evidence: 'Transient failure cooldown passed; successful paths remain excluded.',
            failureClass: 'transient',
            reason: 'The unresolved transient failure is eligible for one controlled retry.',
            state: 'allowed',
          },
        }
      : data,
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

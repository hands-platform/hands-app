import { readFileSync } from 'node:fs';

import { NotificationsTableSection, type NotificationTableRow } from './notifications-table-section';
import {
  classNamesIn,
  elementTypesIn,
  hrefsIn,
  normalizedText,
  textContent,
} from './notification-section-test-utils';

describe('NotificationsTableSection', () => {
  it('uses the shared Vuexy admin card surface for the table shell', () => {
    const source = readFileSync('app/notifications/notifications-table-section.tsx', 'utf8');

    expect(source).toContain('AdminTableCard');
    expect(source).not.toContain('AdminCard');
    expect(source).not.toContain('className="card admin-section vuexy-booking-table-card vuexy-booking-table-group notification-table-shell"');
  });

  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync('app/notifications/notifications-table-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('renders notification delivery evidence and action links', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [buildRow()],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('9 Jun 2026, 10:00');
    expect(rendered).toContain('Updated just now');
    expect(rendered).toContain('Linh Partner');
    expect(rendered).toContain('Partner Massage Pro');
    expect(rendered).toContain('Booking Created');
    expect(rendered).toContain('booking bookin / partner partne');
    expect(rendered).toContain('Retry needed');
    expect(rendered).toContain('FCM');
    expect(rendered).toContain('Failed');
    expect(rendered).toContain('IOS');
    expect(rendered).toContain('Device disabled');
    expect(rendered).toContain('Attempted');
    expect(rendered).toContain('9 Jun 2026, 10:01');
    expect(rendered).toContain('Device last seen');
    expect(rendered).toContain('9 Jun 2026, 10:02');
    expect(rendered).toContain('Token timestamp current');
    expect(rendered).toContain('Failure');
    expect(rendered).toContain('invalid_token');
    expect(rendered).toContain('HTTP');
    expect(rendered).toContain('400');
    expect(rendered).toContain('Reason');
    expect(rendered).toContain('Token expired');
    expect(rendered).toContain('Next Ask the user to reopen the app');
    expect(rendered).toContain('1 failed');
    expect(rendered).toContain('Path ••••1234');
    expect(rendered).toContain('••• ••• 0000');
    expect(rendered).not.toContain('+84900000000');
    expect(rendered).not.toContain('Re-enable device');
    expect(elementTypesIn(section)).toContain('details');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-card vuexy-booking-table-card vuexy-booking-table-group admin-section notification-table-shell has-5-columns',
        'admin-action-dropdown action-menu-dropdown',
        'admin-action-menu action-menu-panel',
        'admin-action-item',
        'vuexy-booking-person',
        'notification-delivery-attempt admin-mb-10',
        'admin-avatar-status-dot is-app-deleted',
      ]),
    );
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partners/partner-1',
        '/notifications?confirm=retry&notificationId=notification-1',
      ]),
    );
  });

  it('summarizes multiple delivery attempts behind a compact disclosure', () => {
    const row = buildRow();
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [
        {
          ...row,
          deliveryAttemptCount: 2,
          deliveryRows: [
            row.deliveryRows[0],
            {
              ...row.deliveryRows[0],
              attemptedAt: '2026-06-09T03:03:00.000Z',
              deviceStateLabel: 'Device enabled',
              failureCodeLabel: '-',
              failureReasonLabel: '-',
              httpStatusLabel: '200',
              id: 'delivery-2',
              platformLabel: 'Android',
              recoveryHintLabel: null,
              status: 'SENT',
              statusClassName: 'pill pill-success',
            },
          ],
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('1 failed · 1 accepted');
    expect(rendered).toContain('2 attempt');
    expect(rendered).toContain('FCM Failed / IOS');
    expect(rendered).toContain('FCM Accepted by FCM / Android');
    expect(rendered.indexOf('FCM Failed / IOS')).toBeLessThan(rendered.indexOf('FCM Accepted by FCM / Android'));
    expect(rendered).not.toContain('Push delivered');
    expect(elementTypesIn(section)).toContain('details');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-disclosure notification-delivery-disclosure',
        'notification-delivery-summary',
        'pill pill-success',
      ]),
    );
  });

  it('distinguishes unavailable push from unconfirmed delivery in operator language', () => {
    const baseRow = buildRow();
    const deliveryGapSection = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [{
        ...baseRow,
        deliveryAttemptCount: 0,
        deliveryRows: [],
        opsSignal: 'No send attempt after 15m',
      }],
    });
    const noPushPathSection = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [{
        ...baseRow,
        deliveryAttemptCount: 0,
        deliveryRows: [],
        opsSignal: 'No active push route',
      }],
    });

    expect(normalizedText(deliveryGapSection)).toContain('No send attempt after 15m');
    expect(normalizedText(noPushPathSection)).toContain('No active push route');
    expect(normalizedText(noPushPathSection)).not.toContain('App offline');
    const rowSource = readFileSync('app/notifications/notification-table-row.tsx', 'utf8');
    expect(rowSource).toContain('avatarStatusLabel={notificationPushRouteStatusLabel(row.userAvatarStatus)}');
    expect(rowSource).toContain("return status === 'online' ? 'Push route: active' : 'Push route: inactive'");
  });

  it('renders one inactive recipient route group with safe identity and occurrence counts', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No route groups.',
      headers: ['Recipient / route', 'Latest notification', 'First / latest', 'Unresolved', 'Next action'],
      rows: [{
        ...buildRow(),
        primaryAction: { href: '/customers/customer-1', kind: 'link', label: 'Open recipient', tone: 'warning' },
        routeGroup: {
          firstOccurredAt: '2026-08-05T06:00:00.000Z',
          latestOccurredAt: '2026-08-05T08:00:00.000Z',
          notificationCount: 12,
          targetRole: 'CUSTOMER',
        },
        userLabel: '••• ••• 0000',
        userPhone: '••• ••• 0000',
      }],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Push route: inactive');
    expect(rendered).toContain('12 notifications');
    expect(rendered).toContain('Open recipient');
    expect(rendered).not.toContain('+84900000000');
  });

  it('shows grouped unresolved cause, age, technical next step, and affected records action', () => {
    const incidentRow: NotificationTableRow = {
      ...buildRow(),
      incident: {
        affectedUserCount: 37,
        failureCode: 'messaging/registration-token-not-registered',
        failureCodeLabel: 'App registration expired',
        firstOccurredAt: '2026-08-05T06:00:00.000Z',
        historical: false,
        href: '/notifications?issue=failed&failureProvider=FCM&failureCode=messaging%2Fregistration-token-not-registered',
        lastOccurredAt: '2026-08-05T06:42:00.000Z',
        notificationCount: 100,
        ownerLabel: 'Platform',
        provider: 'FCM',
        retryCondition: 'Retry after a new enabled route is registered.',
        technicalAction: 'Confirm token cleanup before retrying.',
        windowMinutes: 60,
      },
    };
    const section = NotificationsTableSection({
      emptyMessage: 'No incidents.',
      rows: [incidentRow],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('37 affected user');
    expect(rendered).toContain('100 notification');
    expect(rendered).toContain('messaging/registration-token-not-registered');
    expect(rendered).toContain('Confirm token cleanup before retrying.');
    expect(rendered).toContain('Age Updated just now');
    expect(rendered).toContain('Open this group');
    expect(rendered).toContain('Retry after a new enabled route is registered.');
    expect(rendered).not.toContain('+84900000000');
  });

  it('uses shared badge atoms for technical delivery status', () => {
    const source = readFileSync('app/notifications/notification-delivery-cell.tsx', 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('StatusBadgeLink');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('AdminFormControlLink');
    expect(source).not.toContain('<span className="muted">No devices / not attempted</span>');
    expect(source).not.toContain('<span className={latest.statusClassName}>{latest.status}</span>');
    expect(source).not.toContain('<span className={delivery.statusClassName}>{delivery.status}</span>');
    expect(source).not.toContain('<AdminFormControlLink className="pill pill-warn admin-mt-6" href={delivery.enableDeviceHref}>');
  });

  it('uses the shared DateTimeText atom for delivery attempt timestamps', () => {
    const source = readFileSync('app/notifications/notification-delivery-cell.tsx', 'utf8');
    const modelSource = readFileSync('app/notifications/notification-page-model.ts', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly attemptedAtLabel: string;');
    expect(source).not.toContain('readonly deviceLastSeenAtLabel: string;');
    expect(modelSource).not.toContain('attemptedAtLabel: formatDateTime(delivery.attemptedAt)');
  });

  it('uses the shared AdminSignal atom for notification ops status chips', () => {
    const source = readFileSync('app/notifications/notification-table-row.tsx', 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).not.toContain('<span className={row.signalClassName}>{row.opsSignal}</span>');
  });

  it('uses the shared DateTimeText atom for notification created timestamps', () => {
    const source = readFileSync('app/notifications/notification-table-row.tsx', 'utf8');
    const modelSource = readFileSync('app/notifications/notification-page-model.ts', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdAtLabel: string;');
    expect(source).not.toContain('<div>{row.createdAtLabel}</div>');
    expect(modelSource).not.toContain('createdAtLabel: formatDateTime(notification.createdAt)');
  });

  it('keeps failure evidence visible inside multi-attempt delivery disclosures', () => {
    const row = buildRow();
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [
        {
          ...row,
          deliveryAttemptCount: 2,
          deliveryRows: [
            {
              ...row.deliveryRows[0],
              attemptedAt: '2026-06-09T03:04:00.000Z',
              failureCodeLabel: 'messaging/internal-error',
              failureReasonLabel: 'temporary provider error for [masked]',
              id: 'delivery-2',
              platformLabel: 'Android',
              recoveryHintLabel: 'Retry after Firebase service status and local delivery workers are confirmed.',
            },
            {
              ...row.deliveryRows[0],
              attemptedAt: '2026-06-09T03:03:00.000Z',
              deviceStateLabel: 'Device enabled',
              failureCodeLabel: '-',
              failureReasonLabel: '-',
              httpStatusLabel: '200',
              id: 'delivery-1',
              platformLabel: 'Android',
              recoveryHintLabel: null,
              status: 'SENT',
              statusClassName: 'pill pill-success',
            },
          ],
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('1 failed · 1 accepted');
    expect(rendered).toContain('FCM Failed / Android');
    expect(rendered).toContain('FCM Accepted by FCM / Android');
    expect(rendered.indexOf('FCM Failed / Android')).toBeLessThan(rendered.indexOf('FCM Accepted by FCM / Android'));
    expect(rendered).toContain('Failure messaging/internal-error');
    expect(rendered).toContain('Reason temporary provider error for [masked]');
    expect(rendered).toContain(
      'Next Retry after Firebase service status and local delivery workers are confirmed.',
    );
    expect(rendered).not.toContain('Token hidden');
  });

  it('renders the empty state when there are no notification rows', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications currently match this queue.',
      rows: [],
    });

    expect(textContent(section)).toContain('No notifications currently match this queue.');
  });

  it('supports Finance SLA headers without changing the shared row contract', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No overdue Finance reviews.',
      headers: ['SLA started', 'Owner', 'Source', 'Review', 'SLA status', 'Alert evidence', 'Action'],
      rows: [buildRow()],
    });

    const rendered = normalizedText(section);
    expect(rendered).toContain('SLA started');
    expect(rendered).toContain('Owner');
    expect(rendered).toContain('SLA status');
    expect(rendered).toContain('Alert evidence');
  });

  it('renders rounded pagination when table pagination is provided', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      hrefForPage: (page) => `/notifications?page=${page}`,
      pagination: {
        from: 21,
        page: 2,
        rows: [buildRow()],
        to: 21,
        totalPages: 5,
        totalRows: 81,
      },
      rows: [buildRow()],
    });

    expect(normalizedText(section)).toContain('Showing 21 to 21 of 81 entries');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining(['/notifications?page=1', '/notifications?page=2', '/notifications?page=5']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['vuexy-booking-table-footer notification-table-footer']),
    );
  });
});

function buildRow(): NotificationTableRow {
  return {
    actionLabel: 'Notification actions for notifi',
    actions: [
      {
        href: '/notifications?confirm=retry&notificationId=notification-1',
        kind: 'link',
        label: 'Retry',
        tone: 'warning',
      },
    ],
    body: 'Partner request delivery body',
    bookingDataHint: 'booking bookin / partner partne',
    createdAt: '2026-06-09T03:00:00.000Z',
    deliveryAttemptCount: 1,
    deliveryRows: [
      {
        attemptedAt: '2026-06-09T03:01:00.000Z',
        deviceFreshnessLabel: 'Token timestamp current',
        deviceIdLabel: '••••1234',
        deviceLastSeenAt: '2026-06-09T03:02:00.000Z',
        deviceStateLabel: 'Device disabled',
        failureCodeLabel: 'invalid_token',
        failureReasonLabel: 'Token expired',
        httpStatusLabel: '400',
        id: 'delivery-1',
        platformLabel: 'IOS',
        provider: 'FCM',
        recoveryHintLabel:
          'Ask the user to reopen the app so it can register a fresh FCM token before retrying.',
        status: 'FAILED',
        statusClassName: 'pill pill-warn',
      },
    ],
    id: 'notification-1',
    opsHint: 'Review failure code before retry.',
    opsSignal: 'Retry needed',
    partnerHref: '/partners/partner-1',
    partnerLabel: 'Partner Massage Pro',
    partnerStatus: 'APPROVED',
    relativeCreatedAtLabel: 'Updated just now',
    signalClassName: 'signal signal-warn',
    title: 'Booking Created',
    typeLabel: 'Booking Created',
    typeMeaning: 'Booking lifecycle alert',
    userAvatarStatus: 'app-deleted',
    userHref: '/partners/partner-1',
    userLabel: 'Linh Partner',
    userPhone: '••• ••• 0000',
  };
}

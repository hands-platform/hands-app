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
    expect(rendered).toContain('FAILED');
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
    expect(rendered).toContain('Re-enable device');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-card vuexy-booking-table-card vuexy-booking-table-group admin-section notification-table-shell',
        'admin-table-scroll',
        'admin-action-dropdown action-menu-dropdown',
        'admin-action-menu action-menu-panel',
        'admin-action-item',
        'vuexy-booking-person',
        'notification-delivery-attempt admin-mb-10',
        'admin-avatar-status-dot is-app-deleted',
        'pill pill-warn admin-mt-6',
      ]),
    );
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partners/partner-1',
        '/notifications?confirm=enable-device&pushDeviceId=device-1',
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
            {
              ...row.deliveryRows[0],
              attemptedAt: '2026-06-09T03:03:00.000Z',
              deviceStateLabel: 'Device enabled',
              enableDeviceHref: null,
              failureCodeLabel: '-',
              failureReasonLabel: '-',
              httpStatusLabel: '200',
              id: 'delivery-2',
              platformLabel: 'Android',
              recoveryHintLabel: null,
              status: 'SENT',
              statusClassName: 'pill pill-success',
            },
            row.deliveryRows[0],
          ],
        },
      ],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('2 attempts');
    expect(rendered).toContain('latest FCM / Android / 9 Jun 2026, 10:03');
    expect(rendered).toContain('previous FAILED at 9 Jun 2026, 10:01');
    expect(rendered).toContain('Latest attempt / FCM SENT / Android');
    expect(rendered).not.toContain('Previous attempt / FCM FAILED / IOS');
    expect(rendered).toContain('Previous delivery evidence is summarized above.');
    expect(elementTypesIn(section)).toContain('details');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'admin-disclosure notification-delivery-disclosure',
        'notification-delivery-summary',
        'pill pill-success',
      ]),
    );
  });

  it('uses shared badge atoms for delivery status and recovery links', () => {
    const source = readFileSync('app/notifications/notification-delivery-cell.tsx', 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
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
              recoveryHintLabel: 'Retry after Firebase service health and local worker health are confirmed.',
            },
            {
              ...row.deliveryRows[0],
              attemptedAt: '2026-06-09T03:03:00.000Z',
              deviceStateLabel: 'Device enabled',
              enableDeviceHref: null,
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

    expect(rendered).toContain(
      'FAILED 2 attempts / latest FCM / Android / 9 Jun 2026, 10:04 / previous SENT at 9 Jun 2026, 10:03',
    );
    expect(rendered).toContain('Latest attempt / FCM FAILED / Android');
    expect(rendered).not.toContain('Previous attempt / FCM SENT / Android');
    expect(rendered).toContain('Failure messaging/internal-error');
    expect(rendered).toContain('Reason temporary provider error for [masked]');
    expect(rendered).toContain(
      'Next Retry after Firebase service health and local worker health are confirmed.',
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
        deviceLastSeenAt: '2026-06-09T03:02:00.000Z',
        deviceStateLabel: 'Device disabled',
        enableDeviceHref: '/notifications?confirm=enable-device&pushDeviceId=device-1',
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
    userPhone: '+84900000000',
  };
}

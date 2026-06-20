import { NotificationsTableSection, type NotificationTableRow } from './notifications-table-section';
import {
  classNamesIn,
  elementTypesIn,
  hrefsIn,
  normalizedText,
  textContent,
} from './notification-section-test-utils';

describe('NotificationsTableSection', () => {
  it('renders notification delivery evidence and action links', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [buildRow()],
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('2026-06-09 10:00');
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
    expect(rendered).toContain('2026-06-09 10:01');
    expect(rendered).toContain('Device last seen');
    expect(rendered).toContain('2026-06-09 10:02');
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
        'notification-table-shell',
        'admin-table-scroll',
        'admin-action-dropdown action-menu-dropdown',
        'admin-action-menu action-menu-panel',
        'admin-action-item',
        'vuexy-booking-person',
        'notification-delivery-attempt admin-mb-10',
        'admin-avatar-status-dot is-app-deleted',
        'admin-form-control-link pill pill-warn admin-mt-6',
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
          deliveryRows: [
            {
              ...row.deliveryRows[0],
              attemptedAtLabel: '2026-06-09 10:03',
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
    expect(rendered).toContain('latest FCM / Android / 2026-06-09 10:03');
    expect(rendered).toContain('previous FAILED at 2026-06-09 10:01');
    expect(rendered).toContain('Latest attempt / FCM SENT / Android');
    expect(rendered).toContain('Previous attempt / FCM FAILED / IOS');
    expect(elementTypesIn(section)).toContain('details');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'notification-delivery-disclosure',
        'notification-delivery-summary',
        'pill pill-success',
        'pill pill-warn',
      ]),
    );
  });

  it('keeps failure evidence visible inside multi-attempt delivery disclosures', () => {
    const row = buildRow();
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [
        {
          ...row,
          deliveryRows: [
            {
              ...row.deliveryRows[0],
              attemptedAtLabel: '2026-06-09 10:04',
              failureCodeLabel: 'messaging/internal-error',
              failureReasonLabel: 'temporary provider error for [masked]',
              id: 'delivery-2',
              platformLabel: 'Android',
              recoveryHintLabel: 'Retry after Firebase service health and local worker health are confirmed.',
            },
            {
              ...row.deliveryRows[0],
              attemptedAtLabel: '2026-06-09 10:03',
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
      'FAILED 2 attempts / latest FCM / Android / 2026-06-09 10:04 / previous SENT at 2026-06-09 10:03',
    );
    expect(rendered).toContain('Latest attempt / FCM FAILED / Android');
    expect(rendered).toContain('Previous attempt / FCM SENT / Android');
    expect(rendered).toContain('Failure messaging/internal-error');
    expect(rendered).toContain('Reason temporary provider error for [masked]');
    expect(rendered).toContain(
      'Next Retry after Firebase service health and local worker health are confirmed.',
    );
    expect(rendered.match(/Token hidden/g)).toHaveLength(2);
  });

  it('renders the empty state when there are no notification rows', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications currently match this queue.',
      rows: [],
    });

    expect(textContent(section)).toContain('No notifications currently match this queue.');
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
    createdAtLabel: '2026-06-09 10:00',
    deliveryRows: [
      {
        attemptedAtLabel: '2026-06-09 10:01',
        deviceFreshnessLabel: 'Token timestamp current',
        deviceLastSeenAtLabel: '2026-06-09 10:02',
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

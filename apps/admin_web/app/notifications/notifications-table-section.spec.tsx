import { NotificationsTableSection, type NotificationTableRow } from './notifications-table-section';

describe('NotificationsTableSection', () => {
  it('renders notification delivery evidence and action links', () => {
    const section = NotificationsTableSection({
      emptyMessage: 'No notifications loaded.',
      rows: [buildRow()],
    });

    const rendered = textContent(section);

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
    expect(rendered).toContain('Failure');
    expect(rendered).toContain('invalid_token');
    expect(rendered).toContain('HTTP');
    expect(rendered).toContain('400');
    expect(rendered).toContain('Reason');
    expect(rendered).toContain('Token expired');
    expect(rendered).toContain('Re-enable device');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/partners/partner-1',
        '/notifications?confirm=enable-device&pushDeviceId=device-1',
        '/notifications?confirm=retry&notificationId=notification-1',
      ]),
    );
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
        deviceStateLabel: 'Device disabled',
        enableDeviceHref: '/notifications?confirm=enable-device&pushDeviceId=device-1',
        failureCodeLabel: 'invalid_token',
        failureReasonLabel: 'Token expired',
        httpStatusLabel: '400',
        id: 'delivery-1',
        platformLabel: 'IOS',
        provider: 'FCM',
        status: 'FAILED',
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
    userLabel: 'Linh Partner',
    userPhone: '+84900000000',
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') {
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textContent).join(' ');
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  return textContent(props?.children);
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(hrefsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

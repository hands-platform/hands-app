import type { AdminAuditLog } from '../../lib/admin-api';
import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';

describe('BookingMonitorBlockedCreateSection', () => {
  it('renders gate triage and visible audit evidence', () => {
    const log: AdminAuditLog = {
      action: 'booking.create.rejected',
      createdAt: '2026-06-12T09:00:00.000Z',
      id: 'audit_123456789',
      metadata: {
        addressText: 'Ho Chi Minh City service address',
        customerProfileId: 'customer_123',
        reasonCode: 'BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
      },
      target: 'customer:customer_123',
    };

    const section = BookingMonitorBlockedCreateSection({
      bookingGateTriage: [
        {
          auditHref: '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
          count: 1,
          filter: 'service-area',
          label: 'Service area',
          latestAge: '5m ago',
          operatorHint: 'Confirm the requested address is inside an enabled service area.',
          status: 'Selected',
          tone: 'warn',
        },
      ],
      gateFilter: 'service-area',
      onGateFilterChange: jest.fn(),
      orderedBookingCreateRejections: [log],
      visibleBookingCreateRejections: [log],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Blocked booking attempts');
    expect(rendered).toContain('Create gate filter');
    expect(rendered).toContain('Service area');
    expect(rendered).toContain('Selected');
    expect(rendered).toContain('Address outside service area');
    expect(rendered).toContain('Ho Chi Minh City service address');
    expect(hrefsIn(section)).toEqual(
      expect.arrayContaining([
        '/audit-log?query=booking.create.rejected',
        '/audit-log?query=BOOKING_ADDRESS_OUTSIDE_SERVICE_AREA',
        '/customers/customer_123',
        '/audit-log?query=audit_123456789',
      ]),
    );
  });

  it('wires clear and gate triage actions', () => {
    const onGateFilterChange = jest.fn();
    const section = BookingMonitorBlockedCreateSection({
      bookingGateTriage: [
        {
          auditHref: '/audit-log?query=UNKNOWN',
          count: 0,
          filter: 'unknown',
          label: 'Unknown gate',
          latestAge: 'none',
          operatorHint: 'Inspect the raw audit entry.',
          status: 'Clear',
          tone: 'ok',
        },
      ],
      gateFilter: 'unknown',
      onGateFilterChange,
      orderedBookingCreateRejections: [],
      visibleBookingCreateRejections: [],
    });
    const buttons = buttonsIn(section);
    const clearButton = buttons.find((button) =>
      normalizedText(button.props?.children).includes('Clear create gate'),
    );
    const showButton = buttons.find((button) =>
      normalizedText(button.props?.children).includes('Show this gate'),
    );

    clearButton?.props?.onClick?.();
    showButton?.props?.onClick?.();

    expect(onGateFilterChange).toHaveBeenNthCalledWith(1, 'all');
    expect(onGateFilterChange).toHaveBeenNthCalledWith(2, 'unknown');
    expect(normalizedText(section)).toContain(
      'No blocked booking create attempts match this create gate filter.',
    );
  });
});

type TestButton = {
  readonly props?: {
    readonly children?: unknown;
    readonly onClick?: () => void;
  };
};

function buttonsIn(value: unknown): TestButton[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(buttonsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const current = record?.type === 'button' ? [value as TestButton] : [];
  return [...current, ...buttonsIn(props?.children)];
}

function textContent(value: unknown): string {
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

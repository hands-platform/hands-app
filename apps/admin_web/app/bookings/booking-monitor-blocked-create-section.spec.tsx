import type { AdminAuditLog } from '../../lib/admin-api';
import { buttonsIn, classNamesIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorBlockedCreateSection } from './booking-monitor-blocked-create-section';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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
      onGateFilterChange: vi.fn(),
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
    expect(classNamesIn(section)).toContain('card admin-section admin-mt-16 booking-monitor-blocked-create-card');
  });

  it('wires clear and gate triage actions', () => {
    const onGateFilterChange = vi.fn();
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

  it('uses shared form atoms for the create gate filter controls', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/bookings/booking-monitor-blocked-create-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminFormSelect');
    expect(source).toContain('AdminFormControlButton');
    expect(source).not.toContain('<select');
    expect(source).not.toContain('<button className="button button-secondary" type="button"');
  });

  it('uses the shared AdminFormControlLink atom for audit action links', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/bookings/booking-monitor-blocked-create-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminFormControlLink');
    expect(source).not.toContain('<Link className="button button-secondary"');
  });

  it('uses shared Vuexy badge atoms for attempt and distance evidence chips', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/bookings/booking-monitor-blocked-create-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminSignal');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={`signal ${commandToneClass(item.tone)}`}>{item.status}</span>');
    expect(source).not.toContain('<span className={`signal ${commandToneClass(evidence.tone)}`}>');
    expect(source).not.toContain('<span className="pill">{item.count} attempt(s)</span>');
    expect(source).not.toContain('<span className="pill">{evidence.customerDistanceLabel}</span>');
    expect(source).not.toContain('<span className="pill">{evidence.preferredPartnerDistanceLabel}</span>');
  });

  it('uses the shared DateTimeText atom for visible blocked-create timestamps', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/bookings/booking-monitor-blocked-create-section.tsx'),
      'utf8',
    );

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('Created {formatDate(log.createdAt)}');
  });
});

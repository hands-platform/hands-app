import { classNamesIn, headingTextsIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorCommandRouteSections } from './booking-monitor-command-route-sections';
import { readFileSync } from 'fs';

describe('BookingMonitorCommandRouteSections', () => {
  it('renders command summary and primary queue cards', () => {
    const sections = BookingMonitorCommandRouteSections({
      autoRefresh: true,
      commandSummaryCards: [
        {
          action: 'Confirm the active queue.',
          detail: '2 visible booking(s).',
          href: '/bookings?view=active',
          label: 'Current lane',
          owner: 'Shift lead',
          value: 'Active',
        },
      ],
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:30',
      primaryCommandQueue: [
        {
          count: 2,
          detail: 'Address and matching checks are waiting.',
          href: '/bookings?view=attention',
          primaryAction: 'Open attention queue',
          sampleBookingIds: ['booking_123456789', 'booking_abcdefghi'],
          status: 'Needs operator',
          tone: 'pill-warn',
        },
      ],
    });
    const rendered = normalizedText(sections);

    expect(rendered).toContain('Booking operations command summary');
    expect(rendered).toContain('Live queue health and operator lanes before table review.');
    expect(rendered).toContain('Auto refresh on / last 09:30');
    expect(rendered).toContain('Primary command queue');
    expect(rendered).toContain('Open the lane that needs action; detailed evidence stays in booking detail.');
    expect(rendered).toContain('2 booking(s)');
    expect(headingTextsIn(sections)).toEqual([
      'Booking operations command summary',
      'Primary command queue',
    ]);
    expect(hrefsIn(sections)).toEqual(
      expect.arrayContaining(['/bookings?view=active', '/bookings?view=attention']),
    );
    expect(classNamesIn(sections)).toContain('card admin-section admin-mb-16');
  });

  it('renders paused and refreshing state copy', () => {
    const sections = BookingMonitorCommandRouteSections({
      autoRefresh: false,
      commandSummaryCards: [],
      hasMounted: false,
      isPending: true,
      lastRefreshLabel: 'pending',
      primaryCommandQueue: [],
    });
    const rendered = normalizedText(sections);

    expect(rendered).toContain('Auto refresh paused / refreshing');
    expect(rendered).toContain('0 booking(s)');
  });

  it('hides clear summary cards and clear primary queue groups', () => {
    const sections = BookingMonitorCommandRouteSections({
      autoRefresh: true,
      commandSummaryCards: [
        {
          action: 'Confirm the active queue.',
          detail: '12 visible booking(s).',
          href: '/bookings?view=active',
          label: 'Current lane',
          owner: 'Shift lead',
          value: 'Active',
        },
        {
          action: 'Monitor.',
          detail: 'No immediate booking action is waiting.',
          href: '/bookings?view=active',
          label: 'Top operator action',
          owner: 'Shift lead',
          value: 'Clear',
        },
        {
          action: 'Watch matching.',
          detail: 'Booking demand and partner supply records are loaded.',
          href: '/bookings?view=matching',
          label: 'Dispatch pressure',
          owner: 'Dispatch',
          value: 'Stable',
        },
        {
          action: 'Inspect create audit.',
          detail: 'No blocked create attempt.',
          href: '/bookings?view=blocked-create',
          label: 'Blocked create attempts',
          owner: 'Product ops',
          value: '0',
        },
      ],
      hasMounted: true,
      isPending: false,
      lastRefreshLabel: '09:35',
      primaryCommandQueue: [
        {
          count: 3,
          detail: 'Normal in-progress bookings.',
          href: '/bookings?view=active',
          primaryAction: 'Monitor booking',
          sampleBookingIds: ['booking_success_1'],
          status: 'Normal',
          tone: 'pill-success',
        },
      ],
    });
    const rendered = normalizedText(sections);

    expect(rendered).toContain('Current lane');
    expect(rendered).not.toContain('Top operator action');
    expect(rendered).not.toContain('Dispatch pressure');
    expect(rendered).not.toContain('Blocked create attempts');
    expect(rendered).not.toContain('No primary booking command needs action');
    expect(rendered).not.toContain('Normal in-progress bookings');
  });

  it('uses shared badge atoms for command summary and primary queue chips', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).toContain('AdminSectionHeader');
    expect(source).not.toContain('<span className="pill pill-info">');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('<div className="ops-section-header admin-mt-16">');
    expect(source).not.toContain('<span className="pill">{item.owner}</span>');
    expect(source).not.toContain('<span className={`pill ${item.tone}`}>{item.status}</span>');
    expect(source).not.toContain('<span className="pill" key={bookingId}>');
  });

  it('uses the shared Vuexy text link atom for command route links', () => {
    const source = readFileSync(__filename.replace('.spec.tsx', '.tsx'), 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });
});

import { readFileSync } from 'node:fs';
import type { AdminBooking } from '../../lib/admin-api';
import { classNamesIn, hrefsIn, normalizedText } from './booking-section-test-utils';
import { BookingMonitorNextActionsSection } from './booking-monitor-next-actions-section';

describe('BookingMonitorNextActionsSection', () => {
  it('uses shared Vuexy badge atoms for action count, status, owner, priority, age, and tags', () => {
    const source = readFileSync('app/bookings/booking-monitor-next-actions-section.tsx', 'utf8');

    expect(source).toContain('AdminFilterChipGroup');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="participant-list');
    expect(source).not.toContain('actions={<span className="pill pill-warn">{nextActions.length} action(s)</span>}');
    expect(source).not.toContain('<span className="pill">{item.booking.status}</span>');
    expect(source).not.toContain('<span className="pill">{item.owner}</span>');
    expect(source).not.toContain('<span className="pill">{actionOrderLabel(item.priority)}</span>');
    expect(source).not.toContain('<span className="pill">{bookingAgeLabel(item.booking, nowMs)}</span>');
    expect(source).not.toContain('<span className="pill" key={tag}>');
  });

  it('renders prioritized operator action cards', () => {
    const nowMs = new Date('2026-06-12T10:00:00.000Z').getTime();
    const booking = {
      id: 'booking_123456789',
      payment: {
        currency: 'VND',
        method: 'CASH',
        status: 'AUTHORIZED',
      },
      services: [
        {
          price: 150000,
          service: {
            basePrice: 150000,
            durationMin: 60,
            name: 'Deep Tissue',
            payoutRules: [],
          },
        },
      ],
      status: 'OPEN_MATCHING',
      updatedAt: '2026-06-12T09:40:00.000Z',
    } as unknown as AdminBooking;

    const section = BookingMonitorNextActionsSection({
      getCustomerLabel: () => 'Customer A',
      getProviderLabel: () => 'Provider B',
      nextActions: [
        {
          booking,
          detail: 'Open matching needs Partner supply.',
          href: '/bookings/booking_123456789',
          operatorAction: 'Review dispatch queue.',
          owner: 'Dispatch',
          priority: 'P1',
          tags: ['payment CASH', 'chat pending'],
          title: 'Supply check',
          tone: 'warn',
        },
      ],
      nowMs,
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Next operator actions');
    expect(rendered).toContain('Flagged bookings that need operator review now');
    expect(rendered).toContain('1 action(s)');
    expect(rendered).toContain('Supply check');
    expect(rendered).toContain('Dispatch / Active watch');
    expect(rendered).toContain('Customer A / Partner B');
    expect(rendered).toContain('OPEN_MATCHING');
    expect(hrefsIn(section)).toContain('/bookings/booking_123456789');
    expect(classNamesIn(section)).toContain('card admin-section admin-mt-16 booking-monitor-next-actions-card');
    expect(classNamesIn(section)).toContain('card admin-action-card');
  });

  it('returns no section when no action is waiting', () => {
    const section = BookingMonitorNextActionsSection({
      getCustomerLabel: () => 'Customer A',
      getProviderLabel: () => 'Partner B',
      nextActions: [],
      nowMs: 0,
    });

    expect(section).toBeNull();
  });
});

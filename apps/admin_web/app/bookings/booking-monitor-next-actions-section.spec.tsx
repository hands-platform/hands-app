import type { AdminBooking } from '../../lib/admin-api';
import { BookingMonitorNextActionsSection } from './booking-monitor-next-actions-section';

describe('BookingMonitorNextActionsSection', () => {
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
          detail: 'Open matching needs partner supply.',
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
    expect(rendered).toContain('1 action(s)');
    expect(rendered).toContain('Supply check');
    expect(rendered).toContain('Dispatch / Active watch');
    expect(rendered).toContain('Customer A / Provider B');
    expect(rendered).toContain('OPEN_MATCHING');
    expect(hrefsIn(section)).toContain('/bookings/booking_123456789');
  });

  it('renders clear state when no action is waiting', () => {
    const section = BookingMonitorNextActionsSection({
      getCustomerLabel: () => 'Customer A',
      getProviderLabel: () => 'Provider B',
      nextActions: [],
      nowMs: 0,
    });

    expect(normalizedText(section)).toContain('Booking operations are clear');
    expect(normalizedText(section)).toContain('Clear');
  });
});

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

import type { AdminBooking } from '../../lib/admin-api';
import { BookingMonitorMarketplaceLedgerOverviewSection } from './booking-monitor-marketplace-ledger-overview-section';

describe('BookingMonitorMarketplaceLedgerOverviewSection', () => {
  it('renders ledger summary and operating queue cards', () => {
    const booking = {
      id: 'booking_123456789',
      payment: { currency: 'VND' },
      services: [
        {
          price: 120000,
          service: {
            basePrice: 120000,
            durationMin: 60,
            name: 'Foot Massage',
            payoutRules: [],
          },
        },
      ],
    } as unknown as AdminBooking;

    const section = BookingMonitorMarketplaceLedgerOverviewSection({
      getCustomerLabel: () => 'Customer A',
      marketplaceLedgerSummary: {
        declined: 1,
        firstPick: 2,
        marketplace: 3,
        selected: 1,
        total: 5,
        waitingChoice: 2,
      },
      marketplaceOperatingQueue: [
        {
          bookings: [booking],
          detail: 'Preferred Partner gets the first response window.',
          href: '/bookings?view=first-pick',
          operatorAction: 'Monitor response window.',
          status: 'Running',
          step: '1. First-pick timer control',
          title: 'First-pick timer control',
          tone: 'warn',
          value: '1 waiting',
        },
      ],
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Marketplace participant ledger');
    expect(rendered).toContain('All participant records 5');
    expect(rendered).toContain('Marketplace record boundary');
    expect(rendered).toContain('Actual participation rows');
    expect(rendered).toContain('Customer choice evidence');
    expect(rendered).toContain('Marketplace operating queue');
    expect(rendered).toContain('First-pick timer control');
    expect(rendered).toContain('Customer A');
    expect(headingTextsIn(section)).toEqual([
      'Marketplace participant ledger',
      'Marketplace record boundary',
      'Not finalization rows',
      'Marketplace operating queue',
      'First-pick timer control',
    ]);
    expect(hrefsIn(section)).toContain('/bookings?view=first-pick');
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

function headingTextsIn(value: unknown): string[] {
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(headingTextsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const type = typeof record?.type === 'string' ? record.type : '';
  const ownHeading =
    /^h[1-6]$/.test(type) ? [textContent(props?.children).replace(/\s+/g, ' ').trim()] : [];
  return [...ownHeading, ...headingTextsIn(props?.children)];
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

import { readFileSync } from 'node:fs';

import { PaymentFilterBoardSection } from './payment-filter-board-section';

describe('PaymentFilterBoardSection', () => {
  it('renders one compact server-side directory form and preserves queue context', () => {
    const section = PaymentFilterBoardSection({
      activeFilterDescription: 'completed bookings with verified payment evidence.',
      activeFilterLabel: 'Capture ready',
      activeRange: 'all',
      bookingStatus: 'COMPLETED',
      customerProfileId: 'customer-1',
      evidence: 'verified',
      filteredCount: 4,
      pageSize: 10,
      paymentMethod: 'VNPAY',
      paymentStatus: 'AUTHORIZED',
      q: 'booking-1',
      rangeLabel: 'All dates',
      review: 'capture-ready',
      reviewLinks: [
        { group: 'live', href: '/payments?review=capture-ready', label: 'Capture ready', review: 'capture-ready' },
        { group: 'history', href: '/payments?review=all', label: 'All payments', review: 'all' },
      ],
      sort: 'oldest',
      totalCount: 12,
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Payment queue');
    expect(rendered).toContain('Showing 4 of 12');
    expect(rendered).toContain('Search payments');
    expect(rendered).toContain('Queue: Capture ready');
    expect(rendered).toContain('Evidence: verified');
    expect(rendered).toContain('Booking: COMPLETED');
    expect(rendered).toContain('Order: Oldest first');
    expect(rendered).toContain('Capture ready 0');
    expect(rendered).toContain('More queues Secondary and history');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining([
      '/payments?range=all&review=capture-ready&sort=oldest',
      '/payments?review=capture-ready',
      '/payments?review=all',
    ]));
  });

  it('uses shared form, disclosure, filter summary, and table panel components', () => {
    const source = readFileSync('app/payments/payment-filter-board-section.tsx', 'utf8');

    expect(source).toContain('AdminDirectoryFilterForm');
    expect(source).toContain('AdminFormSearch');
    expect(source).toContain('AdminFormSelect');
    expect(source).toContain('AdminFilterSummary');
    expect(source).toContain('AdminDetails');
    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('paymentRangeLinks');
  });

  it('does not render a false success state for an empty queue', () => {
    const section = PaymentFilterBoardSection({
      activeFilterDescription: null,
      activeFilterLabel: null,
      activeRange: 'all',
      bookingStatus: '',
      customerProfileId: '',
      evidence: '',
      filteredCount: 0,
      pageSize: 10,
      paymentMethod: '',
      paymentStatus: '',
      q: '',
      rangeLabel: 'All dates',
      review: 'all',
      reviewLinks: [{ group: 'history', href: '/payments?review=all', label: 'All payments', review: 'all' }],
      totalCount: 0,
    });

    expect(normalizedText(section)).toContain('Showing 0 of 0');
  });
});

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');
  const record = readRecord(value);
  return textContent(readRecord(record?.props)?.children);
}

function normalizedText(value: unknown) {
  return textContent(value).replace(/\s+/g, ' ').trim();
}

function hrefsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(hrefsIn);
  const props = readRecord(readRecord(value)?.props);
  const href = typeof props?.href === 'string' ? [props.href] : [];
  return [...href, ...hrefsIn(props?.children)];
}

function resolveElement(value: unknown): unknown {
  const record = readRecord(value);
  const props = readRecord(record?.props);
  return typeof record?.type === 'function' ? resolveElement(record.type(props)) : value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

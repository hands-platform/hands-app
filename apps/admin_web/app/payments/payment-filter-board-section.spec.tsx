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
    expect(rendered).toContain('Capture ready 12');
    expect(rendered).toContain('More queues Secondary work 0 · History separate');
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

  it('maps History aliases to scoped summary counts and keeps the active count equal to the table total', () => {
    const section = PaymentFilterBoardSection({
      activeFilterDescription: 'all authorization holds.',
      activeFilterLabel: 'All authorized',
      activeRange: 'all',
      bookingStatus: '',
      customerProfileId: '',
      evidence: '',
      filteredCount: 1,
      historyAliasCounts: {
        all: 3326,
        authorized: 99,
        'callback-verified': 27,
      },
      pageSize: 10,
      paymentMethod: '',
      paymentStatus: '',
      q: '',
      queueCounts: { 'capture-ready': 4, 'history-released': 12 },
      rangeLabel: 'All dates',
      review: 'authorized',
      reviewLinks: [
        { group: 'live', href: '/payments?review=capture-ready', label: 'Capture ready', review: 'capture-ready' },
        { group: 'history', href: '/payments?review=authorized', label: 'All authorized', review: 'authorized' },
        { group: 'history', href: '/payments?review=callback-verified', label: 'Verified callback history', review: 'callback-verified' },
        { group: 'history', href: '/payments?review=all', label: 'All payments', review: 'all' },
      ],
      totalCount: 1,
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Capture ready 4');
    expect(rendered).toContain('All authorized 1');
    expect(rendered).toContain('Verified callback history 27');
    expect(rendered).toContain('All payments 3326');
  });

  it('shows actionable Secondary work without adding History totals', () => {
    const section = PaymentFilterBoardSection({
      activeFilterDescription: 'terminal cash cleanup.',
      activeFilterLabel: 'Terminal cash cleanup',
      activeRange: 'all',
      bookingStatus: '',
      customerProfileId: '',
      evidence: '',
      filteredCount: 10,
      historyAliasCounts: { all: 3326 },
      pageSize: 10,
      paymentMethod: '',
      paymentStatus: '',
      q: '',
      queueCounts: {
        'completed-authorization-blocked': 3,
        'terminal-cash-cleanup': 667,
      },
      rangeLabel: 'All dates',
      review: 'terminal-cash-cleanup',
      reviewLinks: [
        { group: 'exception', href: '/payments?review=terminal-cash-cleanup', label: 'Terminal cash cleanup', review: 'terminal-cash-cleanup' },
        { group: 'exception', href: '/payments?review=completed-authorization-blocked', label: 'Completed authorization blocked', review: 'completed-authorization-blocked' },
        { group: 'history', href: '/payments?review=all', label: 'All payments', review: 'all' },
      ],
      totalCount: 667,
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('More queues Secondary work 670 · History separate');
    expect(rendered).toContain('Terminal cash cleanup 667');
    expect(rendered).not.toContain('Secondary work 3996');
    expect(openDetailsCount(section)).toBeGreaterThan(0);
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

function openDetailsCount(value: unknown): number {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') return 0;
  if (Array.isArray(value)) return value.reduce((total, item) => total + openDetailsCount(item), 0);
  const record = readRecord(value);
  const props = readRecord(record?.props);
  const open = record?.type === 'details' && props?.open === true ? 1 : 0;
  return open + openDetailsCount(props?.children);
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

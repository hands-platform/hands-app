import { EarningsCashDebtQueueSection } from './earnings-cash-debt-queue-section';

describe('EarningsCashDebtQueueSection', () => {
  it('renders cash debt totals, links, and settlement review action', () => {
    const section = EarningsCashDebtQueueSection({
      currency: 'VND',
      items: [
        {
          bookingAmount: 500000,
          bookingHref: '/bookings/booking-1',
          bookingShortId: 'booking-1',
          currency: 'VND',
          debtAmount: 80000,
          earningId: 'earning-1',
          lastLedgerRef: 'LEDGER-1',
          partnerHref: '/partners/partner-1',
          paymentMethod: 'CASH',
          platformFee: 60000,
          providerName: 'Partner One',
          settlementChecklist: ['Confirm deposit before settling.'],
          settlementNotes: 'Cash fee debt settled from admin earnings queue with reference HANDS-WALLET-1',
          settlementReference: 'HANDS-WALLET-1',
          taxAmount: 20000,
        },
      ],
      totals: {
        bookingAmount: 500000,
        debtAmount: 80000,
        platformFee: 60000,
        taxAmount: 20000,
      },
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Cash fee debt queue');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('80.000 VND');
    expect(rendered).toContain('Review fee settlement');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(hrefsIn(section)).toContain('/partners/partner-1');
  });

  it('renders empty state when there is no cash debt', () => {
    const section = EarningsCashDebtQueueSection({
      currency: 'VND',
      items: [],
      totals: {
        bookingAmount: 0,
        debtAmount: 0,
        platformFee: 0,
        taxAmount: 0,
      },
    });

    expect(textContent(section)).toContain('No Partner has unsettled cash fee debt in the current admin result window.');
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

import { readFileSync } from 'node:fs';

import { EarningsCashDebtQueueSection } from './earnings-cash-debt-queue-section';

describe('EarningsCashDebtQueueSection', () => {
  it('uses the shared Vuexy trace summary atom for cash debt totals', () => {
    const source = readFileSync('app/earnings/earnings-cash-debt-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary">');
    expect(source).not.toContain('function CashDebtMetric');
  });

  it('uses the shared Vuexy money atom for visible amounts', () => {
    const source = readFileSync('app/earnings/earnings-cash-debt-queue-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('MoneyText');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('formatMoney(');
  });

  it('renders cash debt totals, links, and settlement review action', () => {
    const section = EarningsCashDebtQueueSection({
      currency: 'VND',
      items: [
        {
          bookingAmount: 500000,
          bookingHref: '/bookings/booking-1',
          bookingShortId: 'booking-1',
          cashAccountingPreview: [
            'Dr Partner receivable 80.000 VND',
            'Cr Platform fee net revenue 60.000 VND',
            'Cr Partner withholding tax payable 20.000 VND',
          ],
          cashAccountingPreviewText: [
            'Dr Partner receivable 80.000 VND',
            'Cr Platform fee net revenue 60.000 VND',
            'Cr Partner withholding tax payable 20.000 VND',
          ],
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

    expect(rendered).toContain('Cash fee debt queue');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('80.000 VND');
    expect(rendered).toContain('Accounting preview');
    expect(rendered).toContain('Dr Partner receivable 80.000 VND');
    expect(rendered).toContain('Cr Platform fee net revenue 60.000 VND');
    expect(rendered).toContain('Cr Partner withholding tax payable 20.000 VND');
    expect(rendered).toContain('Review fee settlement');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-form-input', 'admin-form-control-button button button-primary']),
    );
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
      ]),
    );
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

    expect(textContent(section)).toContain(
      'No Partner has unsettled cash fee debt in the current admin result window.',
    );
    expect(classNamesIn(section)).toContain('empty-state');
  });
});

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

function classNamesIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(classNamesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const className = typeof props?.className === 'string' ? [props.className] : [];
  return [...className, ...classNamesIn(props?.children)];
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

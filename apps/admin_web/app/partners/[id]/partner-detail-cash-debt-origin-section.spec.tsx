import { readFileSync } from 'node:fs';

import { PartnerDetailCashDebtOriginSection } from './partner-detail-cash-debt-origin-section';

describe('PartnerDetailCashDebtOriginSection', () => {
  it('uses the shared Vuexy trace summary atom for cash debt metrics', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-cash-debt-origin-section.tsx', 'utf8');

    expect(source).toContain('AdminTraceSummary');
    expect(source).not.toContain('<div className="service-trace-summary admin-mt-12">');
  });

  it('uses the shared Vuexy badge atoms for cash debt pills', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-cash-debt-origin-section.tsx', 'utf8');
    const pageSource = readFileSync('app/partners/[id]/page.tsx', 'utf8');

    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('<span className="pill pill-danger">HANDS fee');
    expect(source).not.toContain('<span className="pill pill-warn">Tax');
    expect(source).not.toContain('<span className="pill pill-info">{row.evidenceLabel}</span>');
    expect(source).toContain("import type { ReactNode } from 'react';");
    expect(source).toContain('readonly amountLabel: ReactNode;');
    expect(source).toContain('readonly handsFeeLabel: ReactNode;');
    expect(source).toContain('readonly openDebtLabel: ReactNode;');
    expect(source).toContain('readonly taxLabel: ReactNode;');
    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly createdLabel: string;');
    expect(source).not.toContain('created {row.createdLabel}');
    expect(pageSource).not.toContain('createdLabel: formatDate(earning.createdAt)');
    expect(pageSource).toContain('openDebtLabel={<MoneyText amount={cashFeeDebtTotal} />}');
    expect(pageSource).toContain('amountLabel: <MoneyText amount={Math.abs(amountValue(earning.netAmount))} />');
    expect(pageSource).toContain('handsFeeLabel: <MoneyText amount={earning.platformFee} />');
    expect(pageSource).toContain('taxLabel: <MoneyText amount={earning.withholdingAmount} />');
  });

  it('uses the shared Vuexy text-link atom instead of raw text-link classes', () => {
    const source = readFileSync('app/partners/[id]/partner-detail-cash-debt-origin-section.tsx', 'utf8');

    expect(source).toContain('AdminTextLink');
    expect(source).not.toContain('className="text-link"');
  });

  it('renders cash debt origins as a Vuexy table', () => {
    const section = PartnerDetailCashDebtOriginSection({
      hasCashFeeDebt: true,
      hasSettlementRef: false,
      openDebtLabel: '-120,000 VND',
      openRowCount: 1,
      rows: [
        {
          amountLabel: '-120,000 VND',
          bookingHref: '/bookings/booking-1',
          bookingLabel: 'BK-1001',
          createdAt: '2026-06-20T03:00:00.000Z',
          evidenceLabel: 'Needs ref',
          handsFeeLabel: '100,000 VND',
          id: 'debt-1',
          originLabel: 'Cash service fee was not deposited.',
          paymentMethod: 'CASH',
          taxLabel: '20,000 VND',
        },
      ],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Cash debt origin and settlement');
    expect(rendered).toContain('1 open row(s)');
    expect(rendered).toContain('Debt');
    expect(rendered).toContain('Origin');
    expect(rendered).toContain('Booking');
    expect(rendered).toContain('Fees');
    expect(rendered).toContain('Evidence');
    expect(rendered).toContain('Action');
    expect(rendered).toContain('-120,000 VND');
    expect(rendered).toContain('Cash service fee was not deposited.');
    expect(rendered).toContain('Booking BK-1001 / payment CASH / created 20 Jun 2026, 10:00');
    expect(rendered).toContain('HANDS fee 100,000 VND');
    expect(rendered).toContain('Tax 20,000 VND');
    expect(rendered).toContain('Warning state');
    expect(rendered).toContain('Settlement rule');
    expect(rendered).toContain('Needs ref');
    expect(rendered).toContain('Direct first-pick not wallet-blocked');
    expect(rendered).toContain('Use account, KYC, location, push, pricing, and wallet settlement gates for direct flow.');
    expect(rendered).not.toContain('KYC, bank');
    expect(rendered).toContain('Booking evidence');
    expect(rendered).toContain('Settle');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/booking-1', '/cash-settlements']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card card-danger admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
        'pill pill-danger',
        'pill pill-warn',
        'pill pill-info',
        'text-link',
      ]),
    );
    expect(rendered).toContain('Showing 1 to 1 of 1 entries');
  });

  it('renders an empty cash debt table state', () => {
    const section = PartnerDetailCashDebtOriginSection({
      hasCashFeeDebt: false,
      hasSettlementRef: true,
      openDebtLabel: '0 VND',
      openRowCount: 0,
      rows: [],
    });

    const rendered = normalizeSpaces(textContent(section));

    expect(rendered).toContain('Cash debt origin and settlement');
    expect(rendered).toContain('No open cash debt');
    expect(rendered).toContain('No records found');
    expect(rendered).toContain('No open cash-service fee debt is visible for this partner.');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group vuexy-partner-detail-review-card admin-mb-16 admin-section',
        'admin-table-scroll',
        'table vuexy-data-table vuexy-booking-table vuexy-partner-detail-review-table',
        'vuexy-booking-table-footer vuexy-partner-detail-review-footer',
      ]),
    );
    expect(rendered).toContain('Showing 0 entries');
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

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
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

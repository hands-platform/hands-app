import { readFileSync } from 'node:fs';

import Link from 'next/link';

import { PaymentOperationsTableSection, type PaymentOperationsTableRow } from './payment-operations-table-section';

describe('PaymentOperationsTableSection', () => {
  it('renders the compact decision columns and server recommendation', () => {
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments loaded.',
      pagination: pagination([buildRow()], 12),
    });
    const rendered = normalizedText(section);

    expect(rendered).toContain('Payment decisions');
    expect(rendered).toContain('Payment / Booking Customer / Partner Method / amount Current state Decision / Evidence Action');
    expect(rendered).toContain('Payment payment-1 Booking booking-1');
    expect(rendered).toContain('Verified callback');
    expect(rendered).toContain('Capture payment');
    expect(rendered).toContain('Completed booking and verified callback.');
    expect(rendered).toContain('Showing 1 to 1 of 12 entries');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining([
      '/payments/payment-1?returnTo=%2Fpayments',
      '/bookings/booking-1',
      '/payments?confirm=capture&paymentId=payment-1&returnTo=%2Fpayments',
    ]));
  });

  it('reuses shared table, money, date, badge, copy, and pagination atoms', () => {
    const source = readFileSync('app/payments/payment-operations-table-section.tsx', 'utf8');

    expect(source).toContain('AdminDataTable');
    expect(source).toContain('AdminTableScroll');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('MoneyText');
    expect(source).toContain('DateTimeText');
    expect(source).toContain('StatusBadge');
    expect(source).not.toContain('ActionMenu');
    expect(source).toContain('CommandCopyButton');
  });

  it('does not render the repeated execution map or cash settlement form', () => {
    const source = readFileSync('app/payments/payment-operations-table-section.tsx', 'utf8');

    expect(source).not.toContain('Payment action execution map');
    expect(source).not.toContain('executionRows');
    expect(source).not.toContain('cashDebtSettlementForm');
    expect(source).not.toContain('callbackEvidence');
  });

  it('renders a true empty state with no row actions', () => {
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments currently match this queue.',
      pagination: pagination([], 0),
    });

    expect(normalizedText(section)).toContain('No payments currently match this queue.');
    expect(normalizedText(section)).not.toContain('Capture payment');
  });
});

function pagination(rows: readonly PaymentOperationsTableRow[], totalRows: number) {
  return {
    from: rows.length ? 1 : 0,
    hrefForPage: (page: number) => `/payments?page=${page}`,
    page: 1,
    rows,
    to: rows.length,
    totalPages: Math.max(1, Math.ceil(totalRows / 10)),
    totalRows,
  };
}

function buildRow(): PaymentOperationsTableRow {
  return {
    amount: 100000,
    bookingCreatedAt: '2026-08-09T01:00:00.000Z',
    bookingHref: '/bookings/booking-1',
    bookingId: 'booking-1',
    bookingIdLabel: 'booking-1',
    bookingStatus: 'COMPLETED',
    currency: 'VND',
    customerLabel: 'Customer One',
    decisionLabel: 'Capture payment',
    decisionReason: 'Completed booking and verified callback.',
    decisionTone: 'warning',
    evidenceLabel: 'Verified callback',
    evidenceReason: 'Amount and signature verified.',
    evidenceTone: 'success',
    id: 'payment-1',
    method: 'VNPAY',
    partnerLabel: 'Partner One',
    paymentHref: '/payments/payment-1?returnTo=%2Fpayments',
    paymentIdLabel: 'payment-1',
    primaryAction: <Link href="/payments?confirm=capture&paymentId=payment-1&returnTo=%2Fpayments">Capture payment</Link>,
    providerRef: 'provider-ref-1',
    status: 'AUTHORIZED',
    bookingUpdatedAt: '2026-08-09T02:00:00.000Z',
  };
}

function textContent(value: unknown): string {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(textContent).join(' ');
  return textContent(readRecord(readRecord(value)?.props)?.children);
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
  const component = record?.type;
  if (typeof component !== 'function' || component.name === 'CommandCopyButton') {
    return value;
  }
  return resolveElement(component(props));
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

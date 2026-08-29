import { readFileSync } from 'node:fs';

import {
  CustomerBookingOperationBoard,
  type CustomerBookingOperationGroup,
  type CustomerBookingOperationMetric,
} from './customer-booking-operation-board';

const boardSource = readFileSync('app/customers/[id]/customer-booking-operation-board.tsx', 'utf8');
const pageSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');
const globalStyles = readFileSync('app/globals.css', 'utf8');

describe('CustomerBookingOperationBoard', () => {
  it('renders booking situation metrics and Partner avatar rows', () => {
    const board = CustomerBookingOperationBoard({
      basePath: '/customers/customer-1',
      groups: buildGroups(),
      metrics: buildMetrics(),
      searchParams: { range: '7d' },
    });

    const rendered = textContent(board).replace(/\s+/g, ' ');

    expect(rendered).toContain('Recent bookings');
    expect(rendered).toContain('Latest 6 bookings');
    expect(rendered).toContain('View all bookings');
    expect(hrefsIn(board)).toContain('/bookings?view=all&dateRange=all&q=customer-1');
    expect(rendered).toContain('All 6');
    expect(rendered).toContain('Live 3');
    expect(rendered).toContain('Completed 1');
    expect(rendered).toContain('Cancelled 2');
    expect(rendered).toContain('booking-3');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('Money');
    expect(rendered).toContain('Wallet');
    expect(rendered).toContain('CAPTURED / 500.000 VND');
    const classNames = classNamesIn(board);
    expect(classNames.some((className) => className.includes('customer-booking-operation-section'))).toBe(true);
    expect(classNames).toEqual(
      expect.arrayContaining([
        'table vuexy-data-table vuexy-booking-table admin-data-table customer-recent-bookings-table',
        'vuexy-booking-avatar is-partner',
        'vuexy-booking-person',
        'admin-avatar-status-dot is-working',
      ]),
    );
    expect(classNames).not.toContain('admin-table-scroll');
    expect(rendered).not.toContain('Current filters');
    expect(rendered).not.toContain('All records');
  });

  it('renders all six server-bounded operation rows even when a legacy page parameter is present', () => {
    const board = CustomerBookingOperationBoard({
      basePath: '/customers/customer-1',
      groups: [
        group('live', 'Current / In Progress', 'Current booking rows.', 6),
      ],
      metrics: buildMetrics(),
      searchParams: { bookingHistoryPage: '2', range: '7d' },
    });

    const rendered = textContent(board).replace(/\s+/g, ' ');

    expect(rendered).toContain('booking-6');
    expect(rendered).toContain('booking-1');
    expect(boardSource).not.toContain('filteredRows.slice(');
    expect(boardSource).not.toContain('CUSTOMER_BOOKING_OPERATION_PAGE_SIZE');
  });

  it('uses a compact empty state instead of rendering four empty booking tables', () => {
    const board = CustomerBookingOperationBoard({
      basePath: '/customers/customer-1',
      groups: buildGroups().map((operationGroup) => ({
        ...operationGroup,
        rows: [],
        totalRows: 0,
      })),
      metrics: buildMetrics(),
      searchParams: {},
    });

    const rendered = textContent(board).replace(/\s+/g, ' ');
    const classNames = classNamesIn(board);

    expect(rendered).toContain('No recent booking records were found for this customer.');
    expect(rendered).not.toContain('All 0');
    expect(rendered).not.toContain('Live 0');
    expect(rendered).not.toContain('Completed 0');
    expect(rendered).not.toContain('Cancelled 0');
    expect(rendered).not.toContain('Money');
    expect(classNames).not.toContain(
      'table vuexy-data-table vuexy-booking-table admin-data-table customer-recent-bookings-table',
    );
  });

  it('uses shared Vuexy status badge atoms instead of raw operation board pill markup', () => {
    expect(boardSource).toContain('AdminTraceSummary');
    expect(boardSource).toContain("from '../../../components/status-badge'");
    expect(boardSource).toContain("from '../../../components/admin-text-link'");
    expect(boardSource).toContain('AdminTextLink');
    expect(boardSource).not.toContain('className="text-link"');
    expect(boardSource).toContain('StatusBadge');
    expect(boardSource).toContain('StatusBadgeFromPillClass');
    expect(boardSource).not.toContain('statusBadgeToneFromPillClass');
    expect(boardSource).not.toContain('PillClassBadge');
    expect(boardSource).not.toContain('<div className="service-trace-summary admin-mt-12">');
    expect(boardSource).not.toContain('<span className="pill');
    expect(boardSource).not.toContain('<span className={`pill');
  });

  it('uses the shared MoneyText atom for operation board service prices', () => {
    expect(boardSource).toContain("from '../../../components/money-text'");
    expect(boardSource).not.toContain('<p className="muted">{row.servicePriceLabel}</p>');
  });

  it('uses the shared MoneyText atom for operation board payment amounts', () => {
    expect(boardSource).toContain("import type { ReactNode } from 'react';");
    expect(boardSource).toContain('readonly paymentDetailLabel: ReactNode;');
    expect(pageSource).toContain('amount={Number(booking.payment.amount ?? 0)}');
    expect(pageSource).not.toContain('return `${booking.payment.status} / ${formatMoney(');
  });

  it('accepts shared date atoms for visible operation board timestamps', () => {
    expect(boardSource).toContain('readonly helper: ReactNode;');
    expect(boardSource).toContain('readonly bookingHelper: ReactNode;');
    expect(boardSource).toContain('readonly requestTimeLabel: ReactNode;');
    expect(boardSource).toContain('readonly stateDetail: ReactNode;');
    expect(pageSource).toContain('<DateTimeText value={latestActivityAt} />');
    expect(pageSource).toContain('<DateTimeText value={bookingRequestOpenedAt(booking)} />');
    expect(pageSource).toContain('<DateTimeText value={stateAt} />');
    expect(pageSource).not.toContain(
      'helper: latestActivityAt ? `Latest update ${formatDate(latestActivityAt)}`',
    );
    expect(pageSource).not.toContain('bookingHelper: `${booking.status} / State ${formatDate(stateAt)}`');
    expect(pageSource).not.toContain('requestTimeLabel: formatDate(bookingRequestOpenedAt(booking))');
    expect(pageSource).not.toContain('stateDetail: formatDate(stateAt)');
  });

  it('keeps recent bookings in one bounded table without pagination', () => {
    expect(boardSource).toContain('AdminTablePanel');
    expect(boardSource).not.toContain(
      'className="booking-monitor booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group customer-booking-operation-section"',
    );
    expect(boardSource).not.toContain('AdminTablePaginationFooter');
    expect(boardSource).not.toContain('className="customer-booking-operation-footer"');
    expect(boardSource).not.toContain('<AdminTableFooter');
    expect(boardSource).not.toContain('Showing {pageFrom} to {pageTo} of {group.rows.length} entries');
  });

  it('overrides the shared booking table minimum width only for customer detail', () => {
    expect(globalStyles).toMatch(
      /\.customer-booking-operation-section \.customer-recent-bookings-table\s*\{[^}]*min-width:\s*0;[^}]*table-layout:\s*fixed;[^}]*width:\s*100%;/u,
    );
    expect(boardSource).toContain("'Outcome'");
  });
});

function buildMetrics(): readonly CustomerBookingOperationMetric[] {
  return [
    { label: 'Total bookings', value: '4', helper: '1 live / 1 completed', tone: 'pill-info' },
    { label: 'Cancellation split', value: '2', helper: '1 pre-match / 1 Partner cancel', tone: 'pill-warn' },
  ];
}

function buildGroups(): readonly CustomerBookingOperationGroup[] {
  return [
    group('live', 'Current / In Progress', 'Current booking rows.'),
    group('completed', 'Completed', 'Completed booking rows.'),
    group('pre-match-cancelled', 'Pre-match Cancellations', 'Cancelled before matching.'),
    group('partner-cancelled', 'Partner Cancellations', 'Partner cancelled after matching.'),
  ];
}

function group(
  key: string,
  title: string,
  _description: string,
  rowCount = key === 'live' ? 3 : 1,
): CustomerBookingOperationGroup {
  return {
    key,
    rows: Array.from({ length: rowCount }, (_, index) => ({
      addressLabel: 'District 1, Ho Chi Minh City',
      bookingHelper: 'OPEN_MATCHING / State 19 Jun 2026, 10:00',
      bookingHref: `/bookings/booking-${index + 1}`,
      bookingLabel: `booking-${index + 1}`,
      id: `${key}-booking-${index + 1}`,
      partnerAvatarStatus: 'working',
      partnerHelper: 'Selected Partner / 2 participating',
      partnerHref: '/partners/partner-1',
      partnerLabel: 'Smoke Partner',
      paymentDetailLabel: 'CAPTURED / 500.000 VND',
      paymentTypeLabel: 'Wallet',
      requestTimeLabel: '19 Jun 2026, 09:30',
      serviceLabel: 'Aromatherapy Massage / 90 min',
      servicePriceAmount: 500_000,
      servicePriceCurrency: 'VND',
      sortAtMs: Date.parse(`2026-06-${String(index + 1).padStart(2, '0')}T10:00:00.000Z`),
      stateDetail: '19 Jun 2026, 10:00',
      stateLabel: 'OPEN_MATCHING',
      stateTone: 'pill-info',
    })),
    title,
    totalRows: rowCount,
  };
}

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

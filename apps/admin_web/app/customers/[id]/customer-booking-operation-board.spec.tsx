import { readFileSync } from 'node:fs';

import {
  CustomerBookingOperationBoard,
  type CustomerBookingOperationGroup,
  type CustomerBookingOperationMetric,
} from './customer-booking-operation-board';

const boardSource = readFileSync('app/customers/[id]/customer-booking-operation-board.tsx', 'utf8');
const pageSource = readFileSync('app/customers/[id]/page.tsx', 'utf8');

describe('CustomerBookingOperationBoard', () => {
  it('renders booking situation metrics and Partner avatar rows', () => {
    const board = CustomerBookingOperationBoard({
      basePath: '/customers/customer-1',
      groups: buildGroups(),
      metrics: buildMetrics(),
      searchParams: { range: '7d' },
    });

    const rendered = textContent(board).replace(/\s+/g, ' ');

    expect(rendered).toContain('Customer booking situation board');
    expect(rendered).toContain('Current / In Progress');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Pre-match Cancellations');
    expect(rendered).toContain('Partner Cancellations');
    expect(rendered).toContain('Showing 1 to 5 of 11 entries');
    expect(rendered).toContain('Smoke Partner');
    expect(rendered).toContain('Payment Type');
    expect(rendered).toContain('Wallet');
    expect(rendered).toContain('CAPTURED / 500.000 VND');
    expect(rendered).not.toContain('Open');
    expect(rendered).not.toContain('View');
    expect(classNamesIn(board)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group booking-monitor customer-booking-operation-section admin-section',
        'card admin-section admin-mb-16 customer-booking-operation-summary-card',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
        'admin-rounded-pagination vuexy-booking-pagination',
        'vuexy-booking-avatar is-partner',
        'vuexy-booking-person',
        'admin-avatar-status-dot is-working',
      ]),
    );
    expect(classNamesIn(board)).not.toContain('admin-table-scroll');
  });

  it('renders server-bounded operation rows while keeping the full group count for pagination', () => {
    const board = CustomerBookingOperationBoard({
      basePath: '/customers/customer-1',
      groups: [
        {
          ...group('live', 'Current / In Progress', 'Current booking rows.', 5),
          page: 2,
          totalRows: 11,
        },
      ],
      metrics: buildMetrics(),
      searchParams: { range: '7d' },
    });

    const rendered = textContent(board).replace(/\s+/g, ' ');

    expect(rendered).toContain('Showing 6 to 10 of 11 entries');
    expect(rendered).toContain('booking-5');
    expect(rendered).not.toContain('booking-6');
    expect(boardSource).not.toContain('group.rows.slice(');
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

    expect(rendered).toContain('No customer booking operation rows yet');
    expect(rendered).toContain('Current / In Progress');
    expect(rendered).toContain('Completed');
    expect(rendered).toContain('Pre-match Cancellations');
    expect(rendered).toContain('Partner Cancellations');
    expect(rendered).toContain('Payment Type');
    expect(classNames).not.toContain('table vuexy-data-table vuexy-booking-table admin-data-table');
    expect(boardSource).toContain('const hasBookingOperationRows =');
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
    expect(pageSource).not.toContain('helper: latestActivityAt ? `Latest update ${formatDate(latestActivityAt)}`');
    expect(pageSource).not.toContain('bookingHelper: `${booking.status} / State ${formatDate(stateAt)}`');
    expect(pageSource).not.toContain('requestTimeLabel: formatDate(bookingRequestOpenedAt(booking))');
    expect(pageSource).not.toContain('stateDetail: formatDate(stateAt)');
  });

  it('uses the shared table pagination footer for customer booking operation groups', () => {
    expect(boardSource).toContain('AdminTablePanel');
    expect(boardSource).not.toContain(
      'className="booking-monitor booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group customer-booking-operation-section"',
    );
    expect(boardSource).toContain('AdminTablePaginationFooter');
    expect(boardSource).toContain('className="customer-booking-operation-footer"');
    expect(boardSource).not.toContain('<AdminTableFooter');
    expect(boardSource).not.toContain('Showing {pageFrom} to {pageTo} of {group.rows.length} entries');
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
    group('pre-match', 'Pre-match Cancellations', 'Cancelled before matching.'),
    group('partner-cancelled', 'Partner Cancellations', 'Partner cancelled after matching.'),
  ];
}

function group(
  key: string,
  title: string,
  description: string,
  rowCount = key === 'live' ? 11 : 1,
): CustomerBookingOperationGroup {
  return {
    countTone: 'pill-info',
    description,
    emptyMessage: 'Empty',
    key,
    page: 1,
    pageParam: `${key}Page`,
    rows: Array.from({ length: Math.min(rowCount, 5) }, (_, index) => ({
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

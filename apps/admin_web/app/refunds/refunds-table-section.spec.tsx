import { readFileSync } from 'node:fs';

import { RefundsTableSection, type RefundTableRow } from './refunds-table-section';

describe('RefundsTableSection', () => {
  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync('app/refunds/refunds-table-section.tsx', 'utf8');

    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-10">');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('uses the shared money atom for refund operation amounts', () => {
    const source = readFileSync('app/refunds/refunds-table-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('readonly amountLabel: string;');
    expect(source).not.toContain('<td>{row.amountLabel}</td>');
  });

  it('renders refund rows with links and action execution evidence', () => {
    const section = RefundsTableSection({
      emptyMessage: 'No refunds loaded.',
      pagination: pagination([buildRow()], { totalRows: 12 }),
    });

    const rendered = normalizeText(textContent(section));

    expect(rendered).toContain('ref-1');
    expect(rendered).toContain('Showing 1 to 1 of 12 entries');
    expect(rendered).toContain('Customer refund requested');
    expect(rendered).toContain('Refund action execution map');
    expect(rendered).toContain('Match payment ledger');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/booking-1', '/payments#payment-payment-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table admin-data-table',
      ]),
    );
  });

  it('renders empty state when no refunds exist', () => {
    const section = RefundsTableSection({
      emptyMessage: 'No refunds currently match this queue.',
      pagination: pagination([]),
    });

    expect(textContent(section)).toContain('No refunds currently match this queue.');
  });

  it('does not duplicate the base pill class for refund execution badges', () => {
    const row = buildRow();
    const section = RefundsTableSection({
      emptyMessage: 'No refunds loaded.',
      pagination: pagination([
        {
          ...row,
          executionRows: [
            {
              ...row.executionRows[0],
              pillClass: 'pill pill-danger',
            },
          ],
        },
      ]),
    });

    expect(classNamesIn(section)).toContain('pill pill-danger');
    expect(classNamesIn(section)).not.toContain('pill pill pill-danger');
  });
});

function pagination(
  rows: readonly RefundTableRow[],
  input: { page?: number; pageSize?: number; totalRows?: number } = {},
) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const totalRows = input.totalRows ?? rows.length;

  return {
    from: rows.length === 0 ? 0 : (page - 1) * pageSize + 1,
    hrefForPage: (nextPage: number) => `/refunds?page=${nextPage}`,
    page,
    rows,
    to: rows.length === 0 ? 0 : (page - 1) * pageSize + rows.length,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    totalRows,
  };
}

function buildRow(): RefundTableRow {
  return {
    amount: 250000,
    bookingHref: '/bookings/booking-1',
    bookingIdLabel: 'bookin',
    bookingStatus: 'REFUNDED',
    currency: 'VND',
    customerLabel: 'Customer One',
    executionRows: [
      {
        action: 'Match payment ledger',
        operatorRule: 'Do not close the refund case until payment ledger state and refund status match.',
        pillClass: 'pill-danger',
        reason: 'Refund status is REQUESTED, but payment status is CAPTURED.',
        status: 'Update needed',
      },
    ],
    id: 'refund-1',
    opsHint: 'Confirm the payment reversal path and notify the guest once the refund is complete.',
    opsSignal: <span>Customer refund requested</span>,
    partnerLabel: 'Partner One',
    paymentHref: '/payments#payment-payment-1',
    paymentLabel: 'CARD / CAPTURED',
    shortId: 'ref-1',
    status: 'REQUESTED',
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

function normalizeText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
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

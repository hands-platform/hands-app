import { readFileSync } from 'node:fs';

import { PaymentOperationsTableSection, type PaymentOperationsTableRow } from './payment-operations-table-section';

describe('PaymentOperationsTableSection', () => {
  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync('app/payments/payment-operations-table-section.tsx', 'utf8');

    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-10">');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('uses the shared date time atom for payment record dates', () => {
    const source = readFileSync('app/payments/payment-operations-table-section.tsx', 'utf8');
    const presenterSource = readFileSync('app/payments/payment-page-presenters.tsx', 'utf8');
    const rulesSource = readFileSync('app/payments/payment-page-rules.ts', 'utf8');

    expect(source).toContain('DateTimeText');
    expect(source).not.toContain('readonly recordDateLabel: string;');
    expect(source).not.toContain('<div className="muted">{row.recordDateLabel}</div>');
    expect(presenterSource).toContain('paymentRecordDate(payment)');
    expect(presenterSource).not.toContain('recordDateLabel: paymentRecordDateLabel(payment)');
    expect(rulesSource).not.toContain('paymentRecordDateLabel');
  });

  it('uses the shared money atom for payment operation amounts', () => {
    const source = readFileSync('app/payments/payment-operations-table-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('readonly amountLabel: string;');
    expect(source).not.toContain('<td>{row.amountLabel}</td>');
  });

  it('renders payment rows with operation evidence and action links', () => {
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments loaded.',
      pagination: pagination([buildRow()], { totalRows: 12 }),
    });

    const rendered = normalizeText(textContent(section));

    expect(rendered).toContain('payment-1');
    expect(rendered).toContain('Showing 1 to 1 of 12 entries');
    expect(rendered).toContain('AUTHORIZED');
    expect(rendered).toContain('Capture after service');
    expect(rendered).toContain('Payment action execution map');
    expect(rendered).toContain('Gateway callback evidence');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/bookings/booking-1', '/earnings#earning-1', '/refunds#refund-1']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('renders the empty state when there are no payment rows', () => {
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments currently match this queue.',
      pagination: pagination([]),
    });

    expect(textContent(section)).toContain('No payments currently match this queue.');
  });

  it('does not duplicate the base pill class for payment execution badges', () => {
    const row = buildRow();
    const section = PaymentOperationsTableSection({
      emptyMessage: 'No payments loaded.',
      pagination: pagination([
        {
          ...row,
          executionRows: [
            {
              ...row.executionRows[0],
              pillClass: 'pill pill-warn',
            },
          ],
        },
      ]),
    });

    expect(classNamesIn(section)).toContain('pill pill-warn');
    expect(classNamesIn(section)).not.toContain('pill pill pill-warn');
  });
});

function pagination(
  rows: readonly PaymentOperationsTableRow[],
  input: { page?: number; pageSize?: number; totalRows?: number } = {},
) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const totalRows = input.totalRows ?? rows.length;

  return {
    from: rows.length === 0 ? 0 : (page - 1) * pageSize + 1,
    hrefForPage: (nextPage: number) => `/payments?page=${nextPage}`,
    page,
    rows,
    to: rows.length === 0 ? 0 : (page - 1) * pageSize + rows.length,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    totalRows,
  };
}

function buildRow(): PaymentOperationsTableRow {
  return {
    actionLabel: 'Payment actions for paymen',
    actions: [
      {
        href: '/payments/payment-1',
        kind: 'link',
        label: 'Open detail',
        tone: 'info',
      },
    ],
    amount: 100000,
    bookingHref: '/bookings/booking-1',
    bookingIdLabel: 'bookin',
    bookingStatus: 'COMPLETED',
    callbackEvidence: <div>Gateway callback evidence</div>,
    cashDebtLabel: 'Cash fee debt 10.000 VND',
    cashDebtSettlementForm: <form aria-label="Cash debt settlement form" />,
    currency: 'VND',
    customerPhone: '+84900000000',
    earningHref: '/earnings#earning-1',
    executionRows: [
      {
        action: 'Capture',
        operatorRule: 'Capture only after completed service evidence and payment ledger review.',
        pillClass: 'pill-warn',
        reason: 'The service is completed and the authorization hold is still active.',
        status: 'Review capture',
      },
    ],
    id: 'payment-1',
    method: 'CARD',
    opsHint: 'Keep this on hold until the partner completes the service, then capture or refund.',
    opsSignal: <span>Capture after service</span>,
    providerRef: 'provider-ref-1',
    recordDate: '2026-06-09T03:00:00.000Z',
    refundHref: '/refunds#refund-1',
    stateLabel: 'Hold placed, waiting for service completion.',
    status: 'AUTHORIZED',
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

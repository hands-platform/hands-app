import { readFileSync } from 'node:fs';

import { EarningsLedgerSection, type EarningsLedgerRow } from './earnings-ledger-section';

describe('EarningsLedgerSection', () => {
  it('reuses the shared Admin table pagination footer atom', () => {
    const source = readFileSync('app/earnings/earnings-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
  });

  it('uses shared badge atoms for cancellation and payout state chips', () => {
    const source = readFileSync('app/earnings/earnings-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminSignal');
    expect(source).toContain('AdminTextLink');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<span className={row.signalClassName}>{row.statusLabel}</span>');
    expect(source).not.toContain('<span className={`pill ${row.cancellationDecisionTone}`}>');
    expect(source).not.toContain('<span className={`pill ${row.cancellationFeeTone}`}>{row.cancellationFeeLabel}</span>');
    expect(source).not.toContain('<a className="pill pill-info" href={row.payoutBatchHref}>');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain('<span className="pill pill-warn">Not batched</span>');
  });

  it('uses the shared inline fallback atom for unavailable ledger actions', () => {
    const source = readFileSync('app/earnings/earnings-ledger-section.tsx', 'utf8');

    expect(source).toContain('AdminInlineFallback');
    expect(source).not.toContain(
      "<span className=\"muted\">{row.statusLabel === 'PAID' ? 'Paid' : 'No action'}</span>",
    );
  });

  it('renders recent earning ledger rows and available actions', () => {
    const section = EarningsLedgerSection({
      pagination: pagination(
        [
          {
            bookingHref: '/bookings/booking-1',
            bookingPaymentMethod: 'CASH',
            bookingShortId: 'booking-1',
            cashAccountingPreview: [
              'Dr Partner receivable 80.000 VND',
              'Cr Platform fee net revenue 60.000 VND',
              'Cr Partner withholding tax payable 20.000 VND',
            ],
            cancellationDecisionLabel: 'Pending admin decision',
            cancellationDecisionTone: 'pill-warn',
            cancellationFeeLabel: 'Fee held',
            cancellationFeeTone: 'pill-danger',
            createdAtLabel: 'Updated just now',
            feePolicyHint: 'Fee policy: manual',
            grossAmountLabel: '1.000.000 VND',
            id: 'earning-1',
            netAmountLabel: '-80.000 VND',
            netCompanyFeeHint: 'Net company fee ready',
            payoutBatchHref: null,
            payoutBatchLabel: null,
            providerName: 'Partner One',
            providerPhone: '+84900000000',
            settlementMethodLabel: 'Partner deposit',
            settlementRef: 'DEP-1',
            signalClassName: 'signal signal-warn',
            statusHint: 'Cash fee debt blocks Partner wallet until settled',
            statusLabel: 'PENDING',
            taxPolicyHint: 'Tax rule ready',
            transferRef: 'MVP-partner-1',
            platformFeeLabel: '100.000 VND platform fee',
            providerProfileId: 'partner-1',
            canCreatePayout: true,
            canDirectlyPay: true,
            withholdingAmountLabel: '20.000 VND tax withheld',
            walletEntries: ['Wallet DEBIT: -80.000 VND'],
          },
        ],
        { totalRows: 12 },
      ),
    });

    const rendered = normalizeText(textContent(section));

    expect(rendered).toContain('Recent earnings ledger');
    expect(rendered).toContain('Showing 1 to 1 of 12 entries');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Pending admin decision');
    expect(rendered).toContain('Fee held');
    expect(rendered).toContain('Accounting preview');
    expect(rendered).toContain('Dr Partner receivable 80.000 VND');
    expect(rendered).toContain('Cr Platform fee net revenue 60.000 VND');
    expect(rendered).toContain('Cr Partner withholding tax payable 20.000 VND');
    expect(rendered).toContain('Review fee settlement');
    expect(rendered).toContain('Review payout batch');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-form-input', 'admin-form-control-button button button-primary']),
    );
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('renders empty state when there are no ledger rows', () => {
    const section = EarningsLedgerSection({ pagination: pagination([]) });

    expect(textContent(section)).toContain('No earnings loaded.');
  });
});

function pagination(
  rows: readonly EarningsLedgerRow[],
  input: { page?: number; pageSize?: number; totalRows?: number } = {},
) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const totalRows = input.totalRows ?? rows.length;

  return {
    from: rows.length === 0 ? 0 : (page - 1) * pageSize + 1,
    hrefForPage: (nextPage: number) => `/earnings?page=${nextPage}`,
    page,
    rows,
    to: rows.length === 0 ? 0 : (page - 1) * pageSize + rows.length,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    totalRows,
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

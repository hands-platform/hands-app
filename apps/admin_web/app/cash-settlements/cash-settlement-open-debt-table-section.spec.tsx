import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { renderToStaticMarkup } from 'react-dom/server';

import {
  CashSettlementOpenDebtTableSection,
  type CashSettlementOpenDebtTableRow,
} from './cash-settlement-open-debt-table-section';

describe('CashSettlementOpenDebtTableSection', () => {
  it('uses the shared finance table shell instead of wiring table classes directly', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-open-debt-table-section.tsx'),
      'utf8',
    );

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain("import { AdminTextLink } from '../../components/admin-text-link';");
    expect(source).toContain('<AdminTextLink');
    expect(source).not.toContain('className="text-link"');
    expect(source).not.toContain("import Link from 'next/link';");
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).toContain('FinanceDataTable');
    expect(source).toContain('ActionMenu');
    expect(source).toContain('AdminNotePanel');
    expect(source).toContain('AdminStageItem');
    expect(source).toContain('AdminTablePaginationFooter');
    expect(source).not.toContain('AdminTableScroll');
    expect(source).not.toContain('AdminRoundedPagination');
    expect(source).not.toContain('className="vuexy-booking-table"');
    expect(source).not.toContain('Showing {pagination.from} to {pagination.to} of {pagination.totalRows} entries');
    expect(source).toContain('StatusBadge');
    expect(source).toContain('StatusBadgeFromPillClass');
    expect(source).not.toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('PillClassBadge');
    expect(source).not.toContain('<div className="ops-task-note admin-mt-10">');
    expect(source).not.toContain('className="setup-stage-item"');
    expect(source).not.toContain('<span className="pill pill-danger">Final acceptance blocked</span>');
    expect(source).not.toContain('<Link className="pill" href={row.partnerHref}>');
  });

  it('uses the shared money atom for primary open debt table amounts', () => {
    const source = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-open-debt-table-section.tsx'),
      'utf8',
    );

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('debtAmountLabel: string');
    expect(source).not.toContain('bookingAmountLabel: string');
    expect(source).not.toContain('platformFeeLabel: string');
    expect(source).not.toContain('taxAmountLabel: string');
  });

  it('allows action execution reasons to render shared money atoms', () => {
    const sectionSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-open-debt-table-section.tsx'),
      'utf8',
    );
    const modelSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-page-rows.ts'),
      'utf8',
    );

    expect(sectionSource).toContain('readonly reason: ReactNode');
    expect(modelSource).toContain('MoneyText');
    expect(modelSource).not.toContain('customer cash amount is ${formatMoney(');
    expect(modelSource).not.toContain('${formatMoney(row.debtAmount');
  });

  it('allows wallet deduction breakdown lines to render shared money atoms', () => {
    const sectionSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-open-debt-table-section.tsx'),
      'utf8',
    );
    const modelSource = readFileSync(
      join(process.cwd(), 'app/cash-settlements/cash-settlement-page-rows.ts'),
      'utf8',
    );

    expect(sectionSource).toContain('readonly walletDeductionBreakdown: readonly ReactNode[]');
    expect(modelSource).not.toContain('Platform net wallet deduction ${formatMoney(');
    expect(modelSource).not.toContain('Company VAT wallet deduction ${formatMoney(');
    expect(modelSource).not.toContain('Partner tax wallet deduction ${formatMoney(');
  });

  it('renders compact open cash debt rows without per-row operations evidence by default', () => {
    const section = CashSettlementOpenDebtTableSection({
      pagination: pagination([buildRow()], { totalRows: 12 }),
      filters: { page: 1, pageSize: 10, q: '', queue: 'all', range: 'today' },
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Open cash fee debt rows');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Final acceptance blocked');
    expect(rendered.replace(/\s+/g, ' ')).toContain('Company coupon offset: 60.000 VND');
    expect(rendered).toContain('Review settlement');
    expect(rendered.replace(/\s+/g, ' ')).toContain('Showing 1 to 1 of 12 entries');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1', '/bookings/booking-1']));
    expect(hrefsIn(section)).toContain('/cash-settlements?page=2');
    expect(inputDefaultsIn(section)).toEqual(expect.arrayContaining(['earning-1', 'HANDS-CASH-BOOKIN']));
    expect(rendered).not.toContain('Cash settlement action execution map');
    expect(rendered).not.toContain('Accounting preview');
    expect(rendered).not.toContain('Platform net wallet deduction 58.519 VND');
    expect(rendered).not.toContain('Record bank deposit');
    expect(rendered).not.toContain('Finance approver id');
  });

  it('renders full operations evidence when requested', () => {
    const section = CashSettlementOpenDebtTableSection({
      pagination: pagination([buildRow()], { totalRows: 12 }),
      filters: { page: 1, pageSize: 10, q: '', queue: 'all', range: 'today' },
      showOperationsEvidence: true,
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Open cash fee debt rows');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Final acceptance blocked');
    expect(rendered).toContain('Cash settlement action execution map');
    expect(rendered.replace(/\s+/g, ' ')).toContain('Company coupon offset: 60.000 VND');
    expect(rendered).toContain('Platform net wallet deduction 58.519 VND');
    expect(rendered).toContain('Accounting preview');
    expect(rendered).toContain('Dr Partner receivable 110.000 VND');
    expect(rendered).toContain('Cr Platform fee net revenue 58.519 VND');
    expect(rendered).toContain('Cr Company output VAT payable 9.481 VND');
    expect(rendered).toContain('Cr Partner withholding tax payable 42.000 VND');
    expect(rendered).toContain('Coupon offset already applied 60.000 VND');
    expect(rendered).toContain('Record bank deposit');
    expect(rendered).toContain('Finance approver id');
    expect(rendered).toContain('Review settlement');
    expect(rendered.replace(/\s+/g, ' ')).toContain('Showing 1 to 1 of 12 entries');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1', '/bookings/booking-1']));
    expect(hrefsIn(section)).toContain('/cash-settlements?page=2');
    expect(inputDefaultsIn(section)).toEqual(
      expect.arrayContaining(['earning-1', 'provider-1', '500000', 'HANDS-CASH-BOOKIN']),
    );
    const markup = renderToStaticMarkup(section);
    expect(markup).toContain('vuexy-booking-table-card');
    expect(markup).toContain('table vuexy-data-table vuexy-booking-table');
    expect(markup).not.toContain('admin-card-scroll');
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('class="form-input"');
  });

  it('normalizes legacy action pill classes without duplicating the pill prefix', () => {
    const section = CashSettlementOpenDebtTableSection({
      pagination: pagination([buildRow({ actionPillClass: 'pill pill-danger' })]),
      filters: { page: 1, pageSize: 10, q: '', queue: 'all', range: 'today' },
      showOperationsEvidence: true,
    });

    const markup = renderToStaticMarkup(section);

    expect(markup).toContain('class="pill pill-danger"');
    expect(markup).not.toContain('pill pill pill-danger');
  });

  it('renders empty state when no open cash debt rows exist', () => {
    const section = CashSettlementOpenDebtTableSection({
      pagination: pagination([]),
      filters: { page: 1, pageSize: 10, q: '', queue: 'all', range: 'today' },
    });

    expect(textContent(section)).toContain('No cash fee debt is waiting for settlement.');
  });
});

function pagination(
  rows: readonly CashSettlementOpenDebtTableRow[],
  input: { page?: number; pageSize?: number; totalRows?: number } = {},
) {
  const page = input.page ?? 1;
  const pageSize = input.pageSize ?? 10;
  const totalRows = input.totalRows ?? rows.length;

  return {
    from: rows.length === 0 ? 0 : (page - 1) * pageSize + 1,
    page,
    pageSize,
    rows,
    to: rows.length === 0 ? 0 : (page - 1) * pageSize + rows.length,
    totalPages: Math.max(1, Math.ceil(totalRows / pageSize)),
    totalRows,
  };
}

function buildRow(input: { actionPillClass?: string } = {}): CashSettlementOpenDebtTableRow {
  return {
    actionRows: [
      {
        action: 'Settle wallet debt',
        operatorRule: 'Settle only after deposit evidence or approved offset.',
        pillClass: input.actionPillClass ?? 'pill-danger',
        reason: '500.000 VND remains as HANDS fee/tax wallet debt.',
        status: 'Debt open',
      },
    ],
    bookingAmount: 1_000_000,
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'bookin',
    cashCouponOffsetAmount: 60_000,
    createdAtLabel: '26h ago',
    currency: 'VND',
    debtAmount: 500_000,
    depositAmountDefault: '500000',
    debtOrigin: 'Partner collected customer cash; HANDS fee/tax is still unpaid.',
    earningId: 'earning-1',
    lastLedgerRef: 'ledger-1',
    nextAction: 'Confirm Partner deposit before settling.',
    partnerHref: '/partners/partner-1',
    paymentMethod: 'CASH',
    platformFee: 400_000,
    providerProfileId: 'provider-1',
    providerName: 'Partner One',
    providerPhone: '+84900000000',
    serviceLabel: 'Massage / 60 min',
    settlementEvidence: 'Booking cash payment evidence is available.',
    settlementMethodDefault: 'PARTNER_DEPOSIT',
    settlementMethodLabel: 'Partner deposit',
    settlementNotesDefault: 'Partner deposit or approved offset for 500.000 VND using HANDS-CASH-BOOKIN',
    settlementReference: 'HANDS-CASH-BOOKIN',
    taxAmount: 100_000,
    cashAccountingPreview: [
      'Dr Partner receivable 110.000 VND',
      'Cr Platform fee net revenue 58.519 VND',
      'Cr Company output VAT payable 9.481 VND',
      'Cr Partner withholding tax payable 42.000 VND',
      'Coupon offset already applied 60.000 VND',
    ],
    walletDeductionBreakdown: [
      'Platform net wallet deduction 58.519 VND',
      'Company VAT wallet deduction 9.481 VND',
      'Partner tax wallet deduction 42.000 VND',
    ],
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

function inputDefaultsIn(value: unknown): string[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(inputDefaultsIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const defaultValue = typeof props?.defaultValue === 'string' ? [props.defaultValue] : [];
  const valueProp = typeof props?.value === 'string' ? [props.value] : [];
  return [...defaultValue, ...valueProp, ...inputDefaultsIn(props?.children)];
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

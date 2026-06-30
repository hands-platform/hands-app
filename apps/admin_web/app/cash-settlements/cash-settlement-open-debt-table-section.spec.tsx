import {
  CashSettlementOpenDebtTableSection,
  type CashSettlementOpenDebtTableRow,
} from './cash-settlement-open-debt-table-section';
import { renderToStaticMarkup } from 'react-dom/server';

describe('CashSettlementOpenDebtTableSection', () => {
  it('renders open cash debt rows with settlement form defaults', () => {
    const section = CashSettlementOpenDebtTableSection({
      pagination: pagination([buildRow()], { totalRows: 12 }),
      filters: { page: 1, pageSize: 10, q: '', queue: 'all', range: 'today' },
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
    expect(markup).toContain('admin-form-input');
    expect(markup).toContain('admin-form-select');
    expect(markup).toContain('admin-form-control-button');
    expect(markup).not.toContain('class="form-input"');
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

function buildRow(): CashSettlementOpenDebtTableRow {
  return {
    actionRows: [
      {
        action: 'Settle wallet debt',
        operatorRule: 'Settle only after deposit evidence or approved offset.',
        pillClass: 'pill-danger',
        reason: '500.000 VND remains as HANDS fee/tax wallet debt.',
        status: 'Debt open',
      },
    ],
    bookingAmountLabel: '1.000.000 VND',
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'bookin',
    cashCouponOffsetLabel: '60.000 VND',
    createdAtLabel: '26h ago',
    debtAmountLabel: '500.000 VND',
    depositAmountDefault: '500000',
    debtOrigin: 'Partner collected customer cash; HANDS fee/tax is still unpaid.',
    earningId: 'earning-1',
    lastLedgerRef: 'ledger-1',
    nextAction: 'Confirm Partner deposit before settling.',
    partnerHref: '/partners/partner-1',
    paymentMethod: 'CASH',
    platformFeeLabel: '400.000 VND',
    providerProfileId: 'provider-1',
    providerName: 'Partner One',
    providerPhone: '+84900000000',
    serviceLabel: 'Massage / 60 min',
    settlementEvidence: 'Booking cash payment evidence is available.',
    settlementMethodDefault: 'PARTNER_DEPOSIT',
    settlementMethodLabel: 'Partner deposit',
    settlementNotesDefault: 'Partner deposit or approved offset for 500.000 VND using HANDS-CASH-BOOKIN',
    settlementReference: 'HANDS-CASH-BOOKIN',
    taxAmountLabel: '100.000 VND',
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

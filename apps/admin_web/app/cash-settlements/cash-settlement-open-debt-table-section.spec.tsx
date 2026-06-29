import {
  CashSettlementOpenDebtTableSection,
  type CashSettlementOpenDebtTableRow,
} from './cash-settlement-open-debt-table-section';

describe('CashSettlementOpenDebtTableSection', () => {
  it('renders open cash debt rows with settlement form defaults', () => {
    const section = CashSettlementOpenDebtTableSection({
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Open cash fee debt rows');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('Final acceptance blocked');
    expect(rendered).toContain('Cash settlement action execution map');
    expect(rendered).toContain('Record bank deposit');
    expect(rendered).toContain('Review settlement');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/partners/partner-1', '/bookings/booking-1']));
    expect(inputDefaultsIn(section)).toEqual(
      expect.arrayContaining(['earning-1', 'provider-1', '500000', 'HANDS-CASH-BOOKIN']),
    );
  });

  it('renders empty state when no open cash debt rows exist', () => {
    const section = CashSettlementOpenDebtTableSection({ rows: [] });

    expect(textContent(section)).toContain('No cash fee debt is waiting for settlement.');
  });
});

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

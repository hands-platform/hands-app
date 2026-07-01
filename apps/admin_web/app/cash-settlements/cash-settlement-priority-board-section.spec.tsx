import {
  CashSettlementPriorityBoardSection,
  type CashSettlementPriorityBoardRow,
} from './cash-settlement-priority-board-section';

describe('CashSettlementPriorityBoardSection', () => {
  it('renders priority rows with booking links and evidence requirements', () => {
    const section = CashSettlementPriorityBoardSection({
      rows: [buildRow()],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('High debt');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('500.000 VND');
    expect(rendered).toContain('Confirm bank deposit reference');
    expect(hrefsIn(section)).toContain('/bookings/booking-1');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining(['admin-scroll-x admin-mt-12', 'table vuexy-data-table vuexy-booking-table']),
    );
  });

  it('renders empty state when there are no priority rows', () => {
    const section = CashSettlementPriorityBoardSection({ rows: [] });

    expect(textContent(section)).toContain('No settlement priority rows are waiting for finance action.');
  });
});

function buildRow(): CashSettlementPriorityBoardRow {
  return {
    ageLabel: '26h open',
    bookingHref: '/bookings/booking-1',
    bookingLabel: 'bookin',
    debtAmountLabel: '500.000 VND',
    pillClass: 'pill-danger',
    priority: 'High debt',
    providerName: 'Partner One',
    providerPhone: '+84900000000',
    reason: 'Cash fee debt is high.',
    requiredEvidence: ['Confirm bank deposit reference', 'Check booking payment method'],
    unlockResult: ['Final acceptance can reopen', 'Payout release can continue'],
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

import { CashSettlementProviderGroupsSection } from './cash-settlement-provider-groups-section';

describe('CashSettlementProviderGroupsSection', () => {
  it('keeps partner debt groups on the grouped Vuexy table-card shell', () => {
    const section = CashSettlementProviderGroupsSection({
      providers: [
        {
          companyCouponOffset: 0,
          currency: 'VND',
          debtAmount: 170000,
          oldestOpenLabel: '3 days open',
          oldestOpenMs: 259200000,
          platformFee: 150000,
          providerName: 'Partner One',
          providerProfileId: 'partner-1',
          rowCount: 2,
          settlementReference: 'CS-001',
          taxAmount: 20000,
        },
      ],
    });

    expect(classNamesIn(section)).toContain(
      'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
    );
  });
});

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

import { EarningsServiceBridgeSection } from './earnings-service-bridge-section';

describe('EarningsServiceBridgeSection', () => {
  it('renders service bridge summary and rows', () => {
    const section = EarningsServiceBridgeSection({
      currency: 'VND',
      items: [
        {
          batchedCount: 1,
          bookingCount: 2,
          cashBookingCount: 1,
          cashDebtAmount: 50000,
          currency: 'VND',
          grossAmount: 1500000,
          groupKey: 'massage',
          key: 'service-1',
          label: 'Deep Tissue / 90 min',
          matrixBackedCount: 2,
          netAmount: 1000000,
          netCompanyFee: 250000,
          otherCostAmount: 30000,
          paidCount: 0,
          platformFee: 350000,
          providerPayoutAmount: 1000000,
          unbatchedCount: 1,
          vatAmount: 70000,
          withholdingAmount: 100000,
        },
      ],
    });

    const rendered = textContent(section);

    expect(rendered).toContain('Service to earnings bridge');
    expect(rendered).toContain('Deep Tissue / 90 min');
    expect(rendered).toContain('1.500.000 VND');
    expect(rendered).toContain('50.000 VND');
    expect(hrefsIn(section)).toContain('/services');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group',
        'table vuexy-data-table vuexy-booking-table',
      ]),
    );
  });

  it('renders an empty state when no service bridge rows exist', () => {
    const section = EarningsServiceBridgeSection({ currency: 'VND', items: [] });

    expect(textContent(section)).toContain('No earning has linked service details yet.');
  });
});

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

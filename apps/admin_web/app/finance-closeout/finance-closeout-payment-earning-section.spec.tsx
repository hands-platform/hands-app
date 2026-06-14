import { FinanceCloseoutPaymentEarningSection } from './finance-closeout-payment-earning-section';

describe('FinanceCloseoutPaymentEarningSection', () => {
  it('renders earning summary totals and the earnings link', () => {
    const section = FinanceCloseoutPaymentEarningSection({
      currency: 'VND',
      summary: {
        availableNetAmount: 200000,
        count: 3,
        currency: 'VND',
        grossAmount: 900000,
        netAmount: 650000,
        paidNetAmount: 100000,
        pendingNetAmount: 550000,
        platformFee: 180000,
        withholdingAmount: 70000,
      },
    });

    const rendered = textContent(section);

    expect(section.type).toBe('section');
    expect(rendered).toContain('Payment-to-earning checks');
    expect(rendered).toContain('900.000 VND');
    expect(rendered).toContain('3');
    expect(rendered).toContain('earning record(s)');
    expect(rendered).toContain('Pending Partner net');
    expect(hrefsIn(section)).toContain('/earnings');
  });
});

function textContent(value: unknown): string {
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

function readRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

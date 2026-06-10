import { PayoutServiceEvidenceSection } from './payout-service-evidence-section';

describe('PayoutServiceEvidenceSection', () => {
  it('renders service evidence totals and rows', () => {
    const section = PayoutServiceEvidenceSection({
      batchCount: 2,
      currency: 'VND',
      items: [
        {
          batchCount: 2,
          cashDebtAmount: 0,
          currency: 'VND',
          earningCount: 3,
          grossAmount: 1500000,
          groupKey: 'foot',
          key: 'service-1',
          label: 'Foot Massage / 90 min',
          netAmount: 1000000,
          platformFee: 350000,
          withholdingAmount: 150000,
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Payout service evidence');
    expect(rendered).toContain('Foot Massage / 90 min');
    expect(rendered).toContain('1.500.000 VND');
    expect(rendered).toContain('1.000.000 VND');
    expect(hrefsIn(section)).toContain('/services');
  });

  it('renders an empty state when no service evidence is available', () => {
    const section = PayoutServiceEvidenceSection({
      batchCount: 0,
      currency: 'VND',
      items: [],
    });

    expect(textContent(section)).toContain('No payout batch has linked service evidence yet.');
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

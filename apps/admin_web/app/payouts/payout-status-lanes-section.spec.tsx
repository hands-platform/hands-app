import { PayoutStatusLanesSection } from './payout-status-lanes-section';

describe('PayoutStatusLanesSection', () => {
  it('renders payout lanes with batch cards and row links', () => {
    const section = PayoutStatusLanesSection({
      batchCount: 1,
      lanes: [
        {
          batches: [
            {
              amount: 900000,
              currency: 'VND',
              earningCount: 2,
              id: 'batch-123456',
              opsHint: 'Save transfer reference before paid.',
              partnerLabel: 'Partner One',
            },
          ],
          emptyText: 'No blocked payout batch.',
          pillClass: 'pill-warn',
          title: 'Needs review',
        },
      ],
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Payout status lanes');
    expect(rendered).toContain('Needs review');
    expect(rendered).toContain('Partner One');
    expect(rendered).toContain('900.000 VND');
    expect(hrefsIn(section)).toContain('#batch-123456');
  });

  it('renders lane empty text when there are no lane batches', () => {
    const section = PayoutStatusLanesSection({
      batchCount: 0,
      lanes: [
        {
          batches: [],
          emptyText: 'No paid payout batch.',
          pillClass: 'pill-success',
          title: 'Paid',
        },
      ],
    });

    expect(textContent(section)).toContain('No paid payout batch.');
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

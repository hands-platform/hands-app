import { EarningsBatchStateFilterSection } from './earnings-batch-state-filter-section';

describe('EarningsBatchStateFilterSection', () => {
  it('renders filter cards and selected state', () => {
    const section = EarningsBatchStateFilterSection({
      activeState: 'ready',
      cards: [
        {
          amount: 900000,
          count: 2,
          href: '/earnings?batchState=ready',
          label: 'Batch ready',
          state: 'ready',
        },
        {
          amount: 0,
          count: 0,
          href: '/earnings',
          label: 'All rows',
          state: 'all',
        },
      ],
      currency: 'VND',
      ledgerCount: 2,
    });

    const rendered = textContent(section);

    expect(section.type).toBe('div');
    expect(rendered).toContain('Earning batch state filters');
    expect(rendered).toContain('ledger row(s)');
    expect(rendered).toContain('Batch ready');
    expect(rendered).toContain('2');
    expect(rendered).toContain('900.000 VND');
    expect(hrefsIn(section)).toContain('/earnings?batchState=ready');
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

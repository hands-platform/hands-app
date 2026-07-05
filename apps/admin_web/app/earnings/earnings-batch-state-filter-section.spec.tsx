import { readFileSync } from 'node:fs';

import { EarningsBatchStateFilterSection } from './earnings-batch-state-filter-section';

describe('EarningsBatchStateFilterSection', () => {
  it('uses the shared Vuexy pill link surface for active filter tone', () => {
    const source = readFileSync('app/earnings/earnings-batch-state-filter-section.tsx', 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadgeLink');
    expect(source).toContain('statusBadgeToneFromPillClass');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('PillClassBadgeLink');
    expect(source).not.toContain('filter-pill');
  });

  it('uses the shared Vuexy money atom for visible amounts', () => {
    const source = readFileSync('app/earnings/earnings-batch-state-filter-section.tsx', 'utf8');

    expect(source).toContain('MoneyText');
    expect(source).not.toContain('formatMoney(');
  });

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

    expect(rendered).toContain('Earning batch state filters');
    expect(rendered).toContain('ledger row(s)');
    expect(rendered).toContain('Batch ready');
    expect(rendered).toContain('2');
    expect(rendered).toContain('900.000 VND');
    expect(hrefsIn(section)).toContain('/earnings?batchState=ready');
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'pill pill-info',
        'pill pill-neutral',
      ]),
    );
    expect(ariaCurrentValuesIn(section)).toContain('page');
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

function ariaCurrentValuesIn(value: unknown): unknown[] {
  value = resolveElement(value);
  if (value === null || value === undefined || typeof value !== 'object') {
    return [];
  }
  if (Array.isArray(value)) {
    return value.flatMap(ariaCurrentValuesIn);
  }

  const record = readRecord(value);
  const props = readRecord(record?.props);
  const ariaCurrent = props?.['aria-current'] ? [props['aria-current']] : [];
  return [...ariaCurrent, ...ariaCurrentValuesIn(props?.children)];
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  PaymentFilterBoardSection,
  type PaymentFilterLink,
  type PaymentRangeLink,
} from './payment-filter-board-section';

describe('PaymentFilterBoardSection', () => {
  it('renders active payment queue, range links, and review links', () => {
    const section = PaymentFilterBoardSection({
      activeFilterDescription: 'authorized payments tied to completed services.',
      activeFilterLabel: 'Capture review',
      activeRange: '7d',
      filteredCount: 4,
      rangeLabel: 'Last 7 days',
      rangeLinks: buildRangeLinks(),
      review: 'capture',
      reviewLinks: buildFilterLinks(),
      totalCount: 12,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Payment operation filters');
    expect(rendered).toContain('Payment date range: Last 7 days');
    expect(rendered).toContain('Active queue: Capture review - authorized payments tied to completed services.');
    expect(rendered).toContain('Showing 4 of 12');
    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('Last 7 days');
    expect(rendered).toContain('Capture review');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/payments?range=all&review=all', '/payments?range=7d', '/payments?review=capture&range=7d']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'pill pill-warn',
        'pill pill-info',
      ]),
    );
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = PaymentFilterBoardSection({
      activeFilterDescription: null,
      activeFilterLabel: null,
      activeRange: 'all',
      filteredCount: 12,
      rangeLabel: 'All dates',
      rangeLinks: buildRangeLinks(),
      review: '',
      reviewLinks: buildFilterLinks(),
      totalCount: 12,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Showing 12 of 12');
    expect(rendered).not.toContain('Clear filters');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });

  it('uses shared badge link atoms for payment filter shortcuts', () => {
    const source = readFileSync(join(process.cwd(), 'app/payments/payment-filter-board-section.tsx'), 'utf8');

    expect(source).toContain('AdminTablePanel');
    expect(source).toContain('StatusBadgeLink');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('import Link from');
    expect(source).not.toContain('className={`pill ${activeRange === item.range');
    expect(source).not.toContain('<Link className="pill pill-success" href="/payments?range=all&review=all">');
    expect(source).not.toContain('className={`pill ${review === item.review');
  });
});

function buildRangeLinks(): PaymentRangeLink[] {
  return [
    { href: '/payments', label: 'All dates', range: 'all' },
    { href: '/payments?range=7d', label: 'Last 7 days', range: '7d' },
  ];
}

function buildFilterLinks(): PaymentFilterLink[] {
  return [
    { href: '/payments?review=all', label: 'All payments', review: 'all' },
    { href: '/payments?review=capture&range=7d', label: 'Capture review', review: 'capture' },
  ];
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

function normalizedText(value: unknown): string {
  return textContent(value).replace(/\s+/g, ' ').trim();
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

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  RefundFilterBoardSection,
  type RefundFilterLink,
  type RefundRangeLink,
} from './refund-filter-board-section';

describe('RefundFilterBoardSection', () => {
  it('renders active refund queue, range links, and review links', () => {
    const section = RefundFilterBoardSection({
      activeFilterDescription: 'customer refund requests waiting for operator processing.',
      activeFilterLabel: 'Requested',
      activeRange: '30d',
      filteredCount: 3,
      rangeLabel: 'Last 30 days',
      rangeLinks: buildRangeLinks(),
      review: 'requested',
      reviewLinks: buildFilterLinks(),
      totalCount: 9,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Refund operation filters');
    expect(rendered).toContain('Refund date range: Last 30 days');
    expect(rendered).toContain('Active queue: Requested - customer refund requests waiting for operator processing.');
    expect(rendered).toContain('Range: Last 30 days');
    expect(rendered).toContain('Queue: Requested');
    expect(rendered).toContain('Showing 3 of 9');
    expect(rendered).toContain('Clear filters');
    expect(rendered).toContain('Open refunds');
    expect(hrefsIn(section)).toEqual(expect.arrayContaining(['/refunds?range=all&review=all', '/refunds?range=30d', '/refunds?review=requested&range=30d']));
    expect(classNamesIn(section)).toEqual(
      expect.arrayContaining([
        'card admin-filter-panel booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group admin-section',
        'booking-date-filter-bar refund-filter-group admin-mb-12',
        'refund-filter-group-label',
        'booking-date-filter-buttons refund-filter-buttons',
        'booking-date-filter-button is-active',
        'pill pill-warn',
      ]),
    );
  });

  it('renders an unfiltered state without clear filter affordance', () => {
    const section = RefundFilterBoardSection({
      activeFilterDescription: null,
      activeFilterLabel: null,
      activeRange: 'all',
      filteredCount: 9,
      rangeLabel: 'All dates',
      rangeLinks: buildRangeLinks(),
      review: '',
      reviewLinks: buildFilterLinks(),
      totalCount: 9,
    });

    const rendered = normalizedText(section);

    expect(rendered).toContain('Showing 9 of 9');
    expect(rendered).not.toContain('Clear filters');
    expect(classNamesIn(section)).toEqual(expect.arrayContaining(['pill pill-success']));
  });

  it('uses shared badge link atoms for refund filter shortcuts', () => {
    const source = readFileSync(join(process.cwd(), 'app/refunds/refund-filter-board-section.tsx'), 'utf8');

    expect(source).toContain('AdminSegmentedControl');
    expect(source).toContain('AdminFilterSummary');
    expect(source).toContain('AdminTablePanel');
    expect(source).not.toContain('AdminFilterChipGroup');
    expect(source).not.toContain('StatusBadgeLink');
    expect(source).not.toContain('<div className="participant-list admin-mb-12">');
    expect(source).not.toContain('<div className="participant-list">');
    expect(source).not.toContain('className="booking-monitor-filter-panel admin-mt-16 vuexy-booking-table-card vuexy-booking-table-group"');
    expect(source).not.toContain('import Link from');
    expect(source).not.toContain('className={`pill ${activeRange === item.range');
    expect(source).not.toContain('<Link className="pill pill-success" href="/refunds?range=all&review=all">');
    expect(source).not.toContain('className={`pill ${review === item.review');
  });
});

function buildRangeLinks(): RefundRangeLink[] {
  return [
    { href: '/refunds', label: 'All dates', range: 'all' },
    { href: '/refunds?range=30d', label: 'Last 30 days', range: '30d' },
  ];
}

function buildFilterLinks(): RefundFilterLink[] {
  return [
    { href: '/refunds?review=all', label: 'All refunds', review: 'all' },
    { href: '/refunds?review=open&range=30d', label: 'Open refunds', review: 'open' },
    { href: '/refunds?review=requested&range=30d', label: 'Requested', review: 'requested' },
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
